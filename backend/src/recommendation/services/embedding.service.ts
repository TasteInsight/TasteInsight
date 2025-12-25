import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import cuid from 'cuid';
import { PrismaService } from '@/prisma.service';
import { RecommendationCacheService } from './cache.service';
import { FeatureEncoderService } from './feature-encoder.service';
import {
  DishFeatures,
  NumericFeatures,
  UserFeatures,
  EmbeddingServiceConfig,
  VersionedEmbedding,
} from '../interfaces';

/**
 * 嵌入服务
 * 负责生成菜品和用户的特征嵌入向量，用于推荐系统的相似度计算
 */
@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private config: EmbeddingServiceConfig;
  private serviceHealthy = false;

  // 不同版本的嵌入维度
  private readonly EMBEDDING_DIMENSIONS = {
    v1: 128, // 本地 TF-IDF + 特征工程
    v2: 788, // Concat 模型：768 (SBERT) + 20 (数值特征)
    v3: 256, // Fusion 模型：神经网络融合
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cacheService: RecommendationCacheService,
    private readonly featureEncoder: FeatureEncoderService,
  ) {
    this.config = {
      externalEnabled:
        this.configService.get<string>(
          'EXTERNAL_EMBEDDING_SERVICE_ENABLED',
          'false',
        ) === 'true',
      externalServiceUrl: this.configService.get<string>(
        'EXTERNAL_EMBEDDING_SERVICE_URL',
        'http://localhost:5001',
      ),
      externalEmbeddingDim: this.configService.get<number>(
        'EXTERNAL_EMBEDDING_SERVICE_EMBEDDING_DIM',
        256,
      ),
      embeddingDim: this.configService.get<number>(
        'EMBEDDING_SERVICE_EMBEDDING_DIM',
        featureEncoder.getDimension(),
      ),
      batchSize: this.configService.get<number>(
        'EMBEDDING_SERVICE_BATCH_SIZE',
        50,
      ),
      externalVersion: this.configService.get<string>(
        'EXTERNAL_EMBEDDING_SERVICE_VERSION',
        'v2',
      ),
    };
  }

  async onModuleInit() {
    if (this.config.externalEnabled) {
      await this.checkExternalEmbeddingServiceHealth();
    } else {
      this.logger.log('External embedding service is disabled');
    }

    // 确保向量索引存在
    await this.ensureVectorIndexes();
  }

  /**
   * 检查外部嵌入服务健康状态
   */
  async checkExternalEmbeddingServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.externalServiceUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        this.serviceHealthy = data.status === 'healthy';
        this.logger.log(
          `External embedding service health check: ${this.serviceHealthy ? 'healthy' : 'unhealthy'}`,
        );
        return this.serviceHealthy;
      }
    } catch (error) {
      this.logger.warn(
        `External embedding service health check failed: ${error}`,
      );
      this.serviceHealthy = false;
    }
    return false;
  }

  /**
   * 确保为每个存在的嵌入版本创建HNSW向量索引
   *
   * 自动检测数据库中存在的嵌入版本，并为其创建对应维度的索引
   * - 使用HNSW索引配合类型转换 (embedding::vector(dimension))
   * - 支持无维度限制的vector列，通过类型转换指定维度
   * - 如果索引已存在，则跳过（IF NOT EXISTS）
   * - 如果版本没有数据，则跳过
   * - 支持多版本共存
   */
  private async ensureVectorIndexes(): Promise<void> {
    try {
      // 查询数据库中存在的所有版本及其数量
      const versions = await this.prisma.$queryRaw<
        Array<{ version: string; count: bigint }>
      >`
        SELECT version, COUNT(*) as count
        FROM "dish_embeddings"
        WHERE embedding IS NOT NULL
        GROUP BY version
      `;

      if (versions.length === 0) {
        this.logger.log('No embeddings found, skipping index creation');
        return;
      }

      for (const { version, count } of versions) {
        const dimension = this.EMBEDDING_DIMENSIONS[version];

        if (!dimension) {
          this.logger.warn(
            `Unknown embedding version: ${version}, skipping index creation`,
          );
          continue;
        }

        this.logger.log(
          `Found ${count} ${version} embeddings (${dimension}D), ensuring index...`,
        );

        try {
          // 创建版本特定的HNSW索引
          // 使用类型转换 (embedding::vector(dimension)) 为无维度vector列创建特定维度的索引
          // 使用 WHERE 子句创建部分索引，只为特定版本的数据建索引
          // PostgreSQL会在查询时自动选择正确的索引
          const indexName = `dish_embeddings_embedding_${version}_idx`;

          await this.prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS "${indexName}"
            ON "dish_embeddings" USING hnsw ((embedding::vector(${dimension})) vector_cosine_ops)
            WITH (m = 16, ef_construction = 200)
            WHERE version = '${version}' AND embedding IS NOT NULL
          `);

          this.logger.log(`HNSW index for ${version} created/verified`);
        } catch (error) {
          this.logger.error(
            `Failed to create index for ${version}: ${error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to ensure vector indexes: ${error.message}`);
    }
  }

  /**
   * 判断外部嵌入服务是否可用
   * 注意：即使外部服务不可用，系统仍可使用本地嵌入
   */
  isExternalServiceAvailable(): boolean {
    return this.config.externalEnabled && this.serviceHealthy;
  }

  /**
   * 判断嵌入服务是否启用（外部或本地）
   */
  isEnabled(): boolean {
    return true; // 本地嵌入始终可用，外部嵌入作为可选增强
  }

  // ==================== 菜品嵌入相关方法 ====================

  /**
   * 构建菜品特征文本（仅文本特征，用于混合嵌入）
   */
  buildDishFeatureText(dish: DishFeatures): string {
    const parts: string[] = [];

    // 菜品名称（最重要）
    parts.push(`菜品: ${dish.name}`);

    // 标签
    if (dish.tags && dish.tags.length > 0) {
      parts.push(`分类: ${dish.tags.join(', ')}`);
    }

    // 食材
    if (dish.ingredients && dish.ingredients.length > 0) {
      parts.push(`食材: ${dish.ingredients.join(', ')}`);
    }

    // 过敏原
    if (dish.allergens && dish.allergens.length > 0) {
      parts.push(`过敏原: ${dish.allergens.join(', ')}`);
    }

    // 描述
    if (dish.description) {
      parts.push(`描述: ${dish.description}`);
    }

    // 位置信息
    if (dish.canteenName) {
      parts.push(`食堂: ${dish.canteenName}`);
    }
    if (dish.windowName) {
      parts.push(`窗口: ${dish.windowName}`);
    }

    return parts.join('. ');
  }

  /**
   * 提取菜品数值特征（用于混合嵌入）
   */
  extractDishNumericFeatures(dish: DishFeatures): NumericFeatures {
    return {
      price: dish.price,
      spicyLevel: dish.spicyLevel,
      sweetness: dish.sweetness,
      saltiness: dish.saltiness,
      oiliness: dish.oiliness,
      averageRating: dish.averageRating,
      reviewCount: dish.reviewCount,
    };
  }

  /**
   * 从数据库菜品记录转换为 DishFeatures
   */
  mapToDishFeatures(dish: any): DishFeatures {
    return {
      id: dish.id,
      name: dish.name,
      tags: dish.tags || [],
      price: dish.price || 0,
      canteenId: dish.canteenId,
      canteenName: dish.canteenName || dish.canteen?.name,
      windowName: dish.windowName || dish.window?.name,
      description: dish.description || '',
      ingredients: dish.ingredients || [],
      allergens: dish.allergens || [],
      spicyLevel: dish.spicyLevel || 0,
      sweetness: dish.sweetness || 0,
      saltiness: dish.saltiness || 0,
      oiliness: dish.oiliness || 0,
      averageRating: dish.averageRating || 0,
      reviewCount: dish.reviewCount || 0,
    };
  }

  /**
   * 调用外部嵌入服务生成混合嵌入（文本+数值特征）
   */
  async generateHybridEmbedding(
    text: string,
    features: NumericFeatures,
    version?: string,
  ): Promise<number[] | null> {
    if (!this.isExternalServiceAvailable()) {
      return null;
    }

    try {
      const requestBody = {
        text,
        features,
        version: version || this.config.externalVersion || 'v2',
      };

      const response = await fetch(`${this.config.externalServiceUrl}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Hybrid embedding generation failed: ${response.status} - ${errorText}`,
        );
        return null;
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      this.logger.error(`Hybrid embedding generation error: ${error}`);
      return null;
    }
  }

  /**
   * 批量生成混合嵌入向量
   */
  async generateHybridEmbeddingsBatch(
    items: Array<{
      text: string;
      features: NumericFeatures;
    }>,
    version?: string,
  ): Promise<number[][] | null> {
    if (!this.isExternalServiceAvailable() || items.length === 0) {
      return null;
    }

    try {
      const requestBody = {
        items,
        version: version || this.config.externalVersion || 'v2',
      };

      const response = await fetch(
        `${this.config.externalServiceUrl}/embed_batch`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Batch hybrid embedding generation failed: ${response.status} - ${errorText}`,
        );
        return null;
      }

      const data = await response.json();
      return data.embeddings;
    } catch (error) {
      this.logger.error(`Batch hybrid embedding generation error: ${error}`);
      return null;
    }
  }

  /**
   * 生成单个菜品的嵌入向量（同步方法，使用本地特征）
   * 用于不需要调用外部服务的场景
   */
  generateDishEmbeddingLocal(dish: any): number[] {
    const feature = this.mapToDishFeatures(dish);
    return this.buildDishEmbeddingLocal(feature);
  }

  /**
   * 构建本地菜品嵌入向量（使用特征编码器）
   */
  private buildDishEmbeddingLocal(feature: DishFeatures): number[] {
    return this.featureEncoder.encodeDishFeatures(feature);
  }

  /**
   * 更新单个菜品的嵌入向量
   */
  async updateDishEmbedding(dishId: string): Promise<boolean> {
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      include: { canteen: true, window: true },
    });

    if (!dish) {
      this.logger.warn(`Dish not found for embedding update: ${dishId}`);
      return false;
    }

    const feature = this.mapToDishFeatures(dish);
    let embedding: number[] | null = null;
    let embeddingVersion = 'v1';

    // 优先使用外部混合嵌入服务
    if (this.isExternalServiceAvailable()) {
      const text = this.buildDishFeatureText(feature);
      const numericFeatures = this.extractDishNumericFeatures(feature);
      embedding = await this.generateHybridEmbedding(text, numericFeatures);
      if (embedding) {
        embeddingVersion = this.config.externalVersion || 'v2';
      }
    }

    // 如果外部服务不可用或失败，使用本地嵌入
    if (!embedding) {
      embedding = this.buildDishEmbeddingLocal(feature);
      embeddingVersion = 'v1';
    }

    // 保存到数据库（使用 raw query 因为 embedding 是 Unsupported 类型）
    // 使用 ::float[]::vector 确保类型转换正确（避免 bigint[] 转换错误）
    // 使用 cuid() 生成 ID，与 Prisma schema 中的 @default(cuid()) 保持一致
    const id = cuid();
    await this.prisma.$executeRaw`
      INSERT INTO "dish_embeddings" ("id", "dishId", "embedding", "version", "createdAt", "updatedAt")
      VALUES (${id}, ${dishId}, ${embedding}::float[]::vector, ${embeddingVersion}, NOW(), NOW())
      ON CONFLICT ("dishId")
      DO UPDATE SET
        "embedding" = ${embedding}::float[]::vector,
        "version" = ${embeddingVersion},
        "updatedAt" = NOW()
    `;

    // 更新 Redis 缓存
    await this.cacheService.setDishEmbedding(
      dishId,
      embedding,
      embeddingVersion,
    );

    this.logger.debug(
      `Updated embedding for dish ${dishId} (version: ${embeddingVersion})`,
    );
    return true;
  }

  /**
   * 批量更新菜品嵌入向量
   */
  async updateDishEmbeddingsBatch(dishIds: string[]): Promise<number> {
    const dishes = await this.prisma.dish.findMany({
      where: { id: { in: dishIds } },
      include: { canteen: true, window: true },
    });

    if (dishes.length === 0) {
      return 0;
    }

    const features = dishes.map((d) => this.mapToDishFeatures(d));
    let embeddings: number[][] | null = null;
    let embeddingVersion = 'v1';

    // 尝试使用外部混合嵌入服务批量生成
    if (this.isExternalServiceAvailable()) {
      const items = features.map((f) => ({
        text: this.buildDishFeatureText(f),
        features: this.extractDishNumericFeatures(f),
      }));
      embeddings = await this.generateHybridEmbeddingsBatch(items);
      if (embeddings) {
        embeddingVersion = this.config.externalVersion || 'v2';
      }
    }

    // 如果外部服务不可用或失败，使用本地嵌入
    if (!embeddings) {
      embeddings = features.map((f) => this.buildDishEmbeddingLocal(f));
      embeddingVersion = 'v1';
    }

    // 批量保存到数据库
    const version = embeddingVersion;
    for (let i = 0; i < dishes.length; i++) {
      const dish = dishes[i];
      const embedding = embeddings[i];

      // 使用 raw query 保存 vector 类型
      // 使用 ::float[]::vector 确保类型转换正确（避免 bigint[] 转换错误）
      // 使用 cuid() 生成 ID，与 Prisma schema 中的 @default(cuid()) 保持一致
      const id = cuid();
      await this.prisma.$executeRaw`
        INSERT INTO "dish_embeddings" ("id", "dishId", "embedding", "version", "createdAt", "updatedAt")
        VALUES (${id}, ${dish.id}, ${embedding}::float[]::vector, ${version}, NOW(), NOW())
        ON CONFLICT ("dishId")
        DO UPDATE SET
          "embedding" = ${embedding}::float[]::vector,
          "version" = ${version},
          "updatedAt" = NOW()
      `;

      // 更新 Redis 缓存
      await this.cacheService.setDishEmbedding(dish.id, embedding, version);
    }

    return dishes.length;
  }

  /**
   * 为指定食堂的所有在线菜品生成/更新嵌入向量
   */
  async updateDishEmbeddingsByCanteen(canteenId: string): Promise<number> {
    const dishes = await this.prisma.dish.findMany({
      where: { canteenId, status: 'online' },
      include: { canteen: true, window: true },
    });

    if (dishes.length === 0) {
      this.logger.log(`No dishes found for canteen ${canteenId}`);
      return 0;
    }

    this.logger.log(
      `Updating embeddings for ${dishes.length} dishes in canteen ${canteenId}`,
    );

    const batchSize = this.config.batchSize;
    let processedCount = 0;

    for (let i = 0; i < dishes.length; i += batchSize) {
      const batch = dishes.slice(i, i + batchSize);
      const dishIds = batch.map((d) => d.id);
      const count = await this.updateDishEmbeddingsBatch(dishIds);
      processedCount += count;

      this.logger.log(
        `Processed ${processedCount}/${dishes.length} dishes for canteen ${canteenId}`,
      );
    }

    return processedCount;
  }

  /**
   * 获取菜品嵌入向量（优先从缓存获取）
   */
  async getDishEmbedding(dishId: string): Promise<VersionedEmbedding | null> {
    // 1. 先从 Redis 缓存获取
    const cached = await this.cacheService.getDishEmbedding(dishId);
    if (cached) {
      return cached;
    }

    // 2. 从数据库获取（使用 raw query 因为 embedding 是 Unsupported 类型）
    // 注意：需要将 vector 类型转换为 text 以避免 Prisma 反序列化错误
    const dbRecords = await this.prisma.$queryRaw<
      Array<{
        id: string;
        dishId: string;
        embedding: string; // 从 vector 转换为 text
        version: string;
      }>
    >`
      SELECT id, "dishId", embedding::text as embedding, version
      FROM "dish_embeddings"
      WHERE "dishId" = ${dishId}
      LIMIT 1
    `;

    if (dbRecords.length > 0) {
      const dbRecord = dbRecords[0];
      // 将 text 格式的向量解析回 number[]
      const embedding = JSON.parse(dbRecord.embedding) as number[];
      const version = dbRecord.version || 'v1';
      // 缓存到 Redis
      await this.cacheService.setDishEmbedding(dishId, embedding, version);
      return { embedding, version };
    }

    // 3. 如果没有，实时生成
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      include: { canteen: true, window: true },
    });

    if (!dish) {
      return null;
    }

    // 生成并保存
    await this.updateDishEmbedding(dishId);
    return this.cacheService.getDishEmbedding(dishId);
  }

  /**
   * 批量获取菜品嵌入向量
   */
  async getDishEmbeddings(
    dishIds: string[],
  ): Promise<Map<string, VersionedEmbedding>> {
    const result = new Map<string, VersionedEmbedding>();
    if (dishIds.length === 0) {
      return result;
    }

    // 1. 先从 Redis 缓存批量获取
    const cached = await this.cacheService.getDishEmbeddings(dishIds);
    cached.forEach((ve, id) => result.set(id, ve));

    // 2. 找出缺失的 ID
    const missingIds = dishIds.filter((id) => !result.has(id));
    if (missingIds.length === 0) {
      return result;
    }

    // 3. 从数据库获取缺失的（使用 raw query）
    // 注意：需要将 vector 类型转换为 text 以避免 Prisma 反序列化错误
    const dbRecords = await this.prisma.$queryRaw<
      Array<{
        id: string;
        dishId: string;
        embedding: string; // 从 vector 转换为 text
        version: string;
      }>
    >`
      SELECT id, "dishId", embedding::text as embedding, version
      FROM "dish_embeddings"
      WHERE "dishId" = ANY(${missingIds})
    `;

    for (const record of dbRecords) {
      // 将 text 格式的向量解析回 number[]
      // PostgreSQL vector 的 text 格式是 "[1.0,2.0,3.0]"
      const embeddingArray = JSON.parse(record.embedding) as number[];
      const version = record.version || 'v1';
      result.set(record.dishId, { embedding: embeddingArray, version });
      // 缓存到 Redis
      await this.cacheService.setDishEmbedding(
        record.dishId,
        embeddingArray,
        version,
      );
    }

    return result;
  }

  // ==================== 用户嵌入相关方法 ====================

  /**
   * 构建用户特征文本（用于嵌入生成）
   * 直接使用 UserFeatures 的嵌套结构
   */
  buildUserFeatureText(userFeatures: UserFeatures): string {
    const parts: string[] = [];
    const prefs = userFeatures.preferences;
    const favFeatures = userFeatures.favoriteFeatures;
    const browseFeatures = userFeatures.browseFeatures;

    // === 来自 UserPreferenceFeatures ===
    if (prefs) {
      if (prefs.tagPreferences.length > 0) {
        parts.push(`偏好菜系: ${prefs.tagPreferences.join(', ')}`);
      }
      if (prefs.priceMin > 0) {
        parts.push(`价格偏好: ${prefs.priceMin} - ${prefs.priceMax || 50}`);
      }
      if (prefs.meatPreference.length > 0) {
        parts.push(`肉类偏好: ${prefs.meatPreference.join(', ')}`);
      }
      if (prefs.favoriteIngredients.length > 0) {
        parts.push(`喜欢食材: ${prefs.favoriteIngredients.join(', ')}`);
      }
      if (prefs.avoidIngredients.length > 0) {
        parts.push(`不喜欢食材: ${prefs.avoidIngredients.join(', ')}`);
      }

      // 口味偏好
      const flavorParts: string[] = [];
      if (prefs.spicyLevel > 0)
        flavorParts.push(`辣度偏好${prefs.spicyLevel}级`);
      if (prefs.sweetness > 0) flavorParts.push(`甜度偏好${prefs.sweetness}级`);
      if (prefs.saltiness > 0) flavorParts.push(`咸度偏好${prefs.saltiness}级`);
      if (prefs.oiliness > 0) flavorParts.push(`油度偏好${prefs.oiliness}级`);
      if (flavorParts.length > 0) {
        parts.push(`口味: ${flavorParts.join(', ')}`);
      }

      // 食堂偏好
      if (prefs.canteenPreferences.length > 0) {
        parts.push(`食堂偏好: ${prefs.canteenPreferences.join(', ')}`);
      }

      // 餐量偏好
      if (prefs.portionSize) {
        parts.push(`餐量偏好: ${prefs.portionSize}`);
      }
    }

    // === 来自 FavoriteFeatureSummary ===
    if (favFeatures.tagWeights.size > 0) {
      const topTags = [...favFeatures.tagWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      parts.push(`常收藏标签: ${topTags.join(', ')}`);
    }

    // 常去食堂
    if (favFeatures.canteenIds.size > 0) {
      const topCanteens = [...favFeatures.canteenIds].slice(0, 5);
      parts.push(`常去食堂: ${topCanteens.join(', ')}`);
    }

    // 常吃的食材
    if (favFeatures.ingredients.size > 0) {
      const topIngredients = [...favFeatures.ingredients].slice(0, 5);
      parts.push(`常吃食材: ${topIngredients.join(', ')}`);
    }

    // 收藏行为中的口味特征
    const favFlavorParts: string[] = [];
    if (favFeatures.avgSpicyLevel > 0) {
      favFlavorParts.push(`常吃辣度${favFeatures.avgSpicyLevel.toFixed(1)}级`);
    }
    if (favFeatures.avgSweetness > 0) {
      favFlavorParts.push(`常吃甜度${favFeatures.avgSweetness.toFixed(1)}级`);
    }
    if (favFeatures.avgSaltiness > 0) {
      favFlavorParts.push(`常吃咸度${favFeatures.avgSaltiness.toFixed(1)}级`);
    }
    if (favFeatures.avgOiliness > 0) {
      favFlavorParts.push(`常吃油度${favFeatures.avgOiliness.toFixed(1)}级`);
    }
    if (favFlavorParts.length > 0) {
      parts.push(`收藏口味: ${favFlavorParts.join(', ')}`);
    }

    // 收藏行为中的价格特征
    if (favFeatures.avgPrice > 0) {
      parts.push(`常吃价格: ${favFeatures.avgPrice.toFixed(1)}元`);
    }

    // 收藏的菜品
    if (favFeatures.dishIds.size > 0) {
      const topDishes = [...favFeatures.dishIds].slice(0, 5);
      parts.push(`收藏菜品（最新5条）: ${topDishes.join(', ')}`);
    }

    // === 来自 BrowseFeatureSummary ===
    if (browseFeatures.tagWeights.size > 0) {
      const topBrowseTags = [...browseFeatures.tagWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      parts.push(`最近浏览标签: ${topBrowseTags.join(', ')}`);
    }

    // 最近浏览的食堂
    if (browseFeatures.canteenWeights.size > 0) {
      const topBrowseCanteens = [...browseFeatures.canteenWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([canteenId]) => canteenId);
      parts.push(`最近浏览食堂（最新5条）: ${topBrowseCanteens.join(', ')}`);
    }

    // 最近浏览的菜品
    if (browseFeatures.recentDishIds.size > 0) {
      const topRecentDishes = [...browseFeatures.recentDishIds].slice(0, 5);
      parts.push(`最近浏览菜品（最新5条）: ${topRecentDishes.join(', ')}`);
    }

    // === 来自用户过敏原 ===
    if (userFeatures.allergens && userFeatures.allergens.length > 0) {
      parts.push(`过敏原: ${userFeatures.allergens.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * 提取用户数值特征（用于混合嵌入）
   */
  private extractUserNumericFeatures(
    userFeatures: UserFeatures,
  ): NumericFeatures {
    const prefs = userFeatures.preferences;
    const favFeatures = userFeatures.favoriteFeatures;

    // 价格偏好（加权平均：偏好设置70% + 实际行为30%）
    const prefWeight = 0.7;
    const favWeight = 0.3;
    const prefAvgPrice = prefs ? (prefs.priceMin + prefs.priceMax) / 2 : 25;
    const avgPrice =
      prefAvgPrice * prefWeight + favFeatures.avgPrice * favWeight;

    // 口味偏好（加权平均）
    const spicyLevel = prefs
      ? prefs.spicyLevel * prefWeight + favFeatures.avgSpicyLevel * favWeight
      : favFeatures.avgSpicyLevel;
    const sweetness = prefs
      ? prefs.sweetness * prefWeight + favFeatures.avgSweetness * favWeight
      : favFeatures.avgSweetness;
    const saltiness = prefs
      ? prefs.saltiness * prefWeight + favFeatures.avgSaltiness * favWeight
      : favFeatures.avgSaltiness;
    const oiliness = prefs
      ? prefs.oiliness * prefWeight + favFeatures.avgOiliness * favWeight
      : favFeatures.avgOiliness;

    return {
      price: avgPrice,
      spicyLevel,
      sweetness,
      saltiness,
      oiliness,
      // 用户没有评分和评论数，设为默认值
      averageRating: 0,
      reviewCount: 0,
    };
  }

  /**
   * 构建本地用户特征嵌入向量（使用特征编码器）
   */
  private buildUserEmbeddingLocal(userFeatures: UserFeatures): number[] {
    return this.featureEncoder.encodeUserFeatures(userFeatures);
  }

  /**
   * 生成用户嵌入向量并存储到 Redis
   */
  async generateUserEmbedding(
    userId: string,
    userFeatures: UserFeatures,
  ): Promise<VersionedEmbedding | null> {
    let embedding: number[] | null = null;
    let version = 'v1';

    // 优先使用外部混合嵌入服务
    if (this.isExternalServiceAvailable()) {
      const text = this.buildUserFeatureText(userFeatures);
      const numericFeatures = this.extractUserNumericFeatures(userFeatures);
      embedding = await this.generateHybridEmbedding(text, numericFeatures);
      if (embedding) {
        version = this.config.externalVersion || 'v2';
      }
    }

    // 如果外部嵌入服务不可用或失败，使用本地嵌入
    if (!embedding) {
      embedding = this.buildUserEmbeddingLocal(userFeatures);
      version = 'v1';
    }

    // 存储到 Redis（用户嵌入不存数据库，因为变化频繁）
    await this.cacheService.setUserEmbedding(userId, embedding, version);

    this.logger.debug(
      `Generated embedding for user ${userId} (version: ${version})`,
    );
    return { embedding, version };
  }

  /**
   * 获取用户嵌入向量（从 Redis 缓存）
   */
  async getUserEmbedding(userId: string): Promise<VersionedEmbedding | null> {
    return this.cacheService.getUserEmbedding(userId);
  }

  /**
   * 更新用户嵌入（当用户偏好或行为变化时调用）
   */
  async updateUserEmbedding(
    userId: string,
    userFeatures: UserFeatures,
  ): Promise<void> {
    await this.generateUserEmbedding(userId, userFeatures);
  }

  /**
   * 使用户嵌入缓存失效
   */
  async invalidateUserEmbedding(userId: string): Promise<void> {
    await this.cacheService.invalidateUserEmbedding(userId);
  }

  // ==================== 版本管理方法 ====================

  /**
   * 版本优先级（数字越大越高）
   */
  private readonly VERSION_ORDER: Record<string, number> = {
    v1: 1,
    v2: 2,
    v3: 3,
  };

  /**
   * 获取当前目标版本（外部服务版本或本地版本）
   */
  getTargetVersion(): string {
    return this.isExternalServiceAvailable()
      ? this.config.externalVersion || 'v2'
      : 'v1';
  }

  /**
   * 比较版本优先级
   * @returns 正数表示 v1 > v2，负数表示 v1 < v2，0 表示相等
   */
  private compareVersions(v1: string, v2: string): number {
    return (this.VERSION_ORDER[v1] || 0) - (this.VERSION_ORDER[v2] || 0);
  }

  /**
   * 升级菜品嵌入到目标版本
   */
  async upgradeDishEmbedding(
    dishId: string,
    targetVersion: string,
  ): Promise<VersionedEmbedding | null> {
    const dish = await this.prisma.dish.findUnique({
      where: { id: dishId },
      include: { canteen: true, window: true },
    });

    if (!dish) {
      return null;
    }

    const feature = this.mapToDishFeatures(dish);
    let embedding: number[] | null = null;

    if (targetVersion === 'v1') {
      // 本地嵌入
      embedding = this.buildDishEmbeddingLocal(feature);
    } else {
      // 调用外部服务
      const text = this.buildDishFeatureText(feature);
      const numericFeatures = this.extractDishNumericFeatures(feature);
      embedding = await this.generateHybridEmbedding(
        text,
        numericFeatures,
        targetVersion,
      );
    }

    if (!embedding) {
      return null;
    }

    // 更新数据库和缓存（使用 raw query）
    // 使用 ::float[]::vector 确保类型转换正确（避免 bigint[] 转换错误）
    // 使用 cuid() 生成 ID，与 Prisma schema 中的 @default(cuid()) 保持一致
    const id = cuid();
    await this.prisma.$executeRaw`
      INSERT INTO "dish_embeddings" ("id", "dishId", "embedding", "version", "createdAt", "updatedAt")
      VALUES (${id}, ${dishId}, ${embedding}::float[]::vector, ${targetVersion}, NOW(), NOW())
      ON CONFLICT ("dishId")
      DO UPDATE SET
        "embedding" = ${embedding}::float[]::vector,
        "version" = ${targetVersion},
        "updatedAt" = NOW()
    `;
    await this.cacheService.setDishEmbedding(dishId, embedding, targetVersion);

    return { embedding, version: targetVersion };
  }

  /**
   * 升级用户嵌入到目标版本
   */
  async upgradeUserEmbedding(
    userId: string,
    targetVersion: string,
  ): Promise<VersionedEmbedding | null> {
    // 从缓存获取用户特征
    const userFeatures = await this.cacheService.getUserFeatures(userId);
    if (!userFeatures) {
      this.logger.warn(
        `Cannot upgrade user embedding: user features not found for ${userId}`,
      );
      return null;
    }

    let embedding: number[] | null = null;

    if (targetVersion === 'v1') {
      // 本地嵌入
      embedding = this.buildUserEmbeddingLocal(userFeatures);
    } else {
      // 调用外部服务
      const text = this.buildUserFeatureText(userFeatures);
      const numericFeatures = this.extractUserNumericFeatures(userFeatures);
      embedding = await this.generateHybridEmbedding(
        text,
        numericFeatures,
        targetVersion,
      );
    }

    if (!embedding) {
      return null;
    }

    // 更新缓存
    await this.cacheService.setUserEmbedding(userId, embedding, targetVersion);

    return { embedding, version: targetVersion };
  }

  // ==================== 相似度计算方法 ====================

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    return this.featureEncoder.cosineSimilarity(vec1, vec2);
  }

  // ==================== 向量召回方法 ====================

  /**
   * 基于用户向量召回最相似的菜品（语义召回）
   *
   * 这是推荐系统的核心召回路径之一，通过向量相似度检索
   * 能够发现语义相关但关键词不匹配的菜品
   *
   * @param userId 用户ID
   * @param limit 召回数量
   * @param filter 可选的过滤条件（如食堂、价格范围）
   * @returns 召回的菜品ID列表（按相似度降序）
   */
  async recallDishesByUserEmbedding(
    userId: string,
    limit: number = 50,
    filter?: Prisma.DishWhereInput,
  ): Promise<string[]> {
    // 1. 获取用户嵌入向量
    const userEmbedding = await this.getUserEmbedding(userId);
    if (!userEmbedding) {
      this.logger.warn(
        `No user embedding found for ${userId}, cannot perform vector recall`,
      );
      return [];
    }

    // 2. 从WHERE条件构建SQL子句
    const whereClauses: string[] = ['de.version = $2', "d.status = 'online'"];
    if (filter) {
      // 处理AND数组中的条件
      const conditions =
        filter.AND && Array.isArray(filter.AND) ? filter.AND : [filter];

      conditions.forEach((cond) => {
        // 食堂ID过滤
        if (cond.canteenId) {
          if (typeof cond.canteenId === 'string') {
            whereClauses.push(`d."canteenId" = '${cond.canteenId}'`);
          } else if (
            typeof cond.canteenId === 'object' &&
            'in' in cond.canteenId
          ) {
            const ids = (cond.canteenId.in as string[])
              .map((id) => `'${id}'`)
              .join(',');
            whereClauses.push(`d."canteenId" IN (${ids})`);
          }
        }
        // 价格范围过滤
        if (cond.price && typeof cond.price === 'object') {
          const pf = cond.price;
          if (pf.gte !== undefined) whereClauses.push(`d.price >= ${pf.gte}`);
          if (pf.lte !== undefined) whereClauses.push(`d.price <= ${pf.lte}`);
        }
        // ID排除过滤
        if (cond.id && typeof cond.id === 'object' && 'notIn' in cond.id) {
          const ids = (cond.id.notIn as string[])
            .map((id) => `'${id}'`)
            .join(',');
          whereClauses.push(`d.id NOT IN (${ids})`);
        }
      });
    }
    const whereSQL = whereClauses.join(' AND ');
    try {
      // 使用余弦距离（<=>）进行向量相似度搜索
      const results = await this.prisma.$queryRawUnsafe<
        Array<{ dishId: string; distance: number }>
      >(
        `
        SELECT 
          de."dishId",
          de.embedding <=> $1::vector AS distance
        FROM "dish_embeddings" de
        INNER JOIN "dishes" d ON de."dishId" = d.id
        WHERE ${whereSQL}
        ORDER BY distance ASC
        LIMIT $3
        `,
        `[${userEmbedding.embedding.join(',')}]`,
        userEmbedding.version,
        limit,
      );

      return results.map((r) => r.dishId);
    } catch (error) {
      this.logger.error(`Vector recall failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 基于查询文本向量召回相关菜品（用于语义搜索）
   *
   * 当用户输入"开胃的"、"解腻的"等模糊描述时，
   * 传统关键词搜索无法匹配，而向量召回可以找到语义相关的菜品
   *
   * @param queryText 搜索文本
   * @param limit 召回数量
   * @param version 嵌入版本
   * @returns 召回的菜品ID列表
   */
  async recallDishesByQueryText(
    queryText: string,
    limit: number = 50,
    version?: string,
  ): Promise<string[]> {
    if (!this.isExternalServiceAvailable()) {
      this.logger.warn(
        'External embedding service not available for query vector recall',
      );
      return [];
    }

    // 1. 将查询文本转换为向量
    const targetVersion = version || this.config.externalVersion || 'v2';

    try {
      const queryEmbedding = await this.generateHybridEmbedding(
        queryText,
        { price: 0 }, // Dummy numeric features for text-only query
        targetVersion,
      );

      if (!queryEmbedding) {
        return [];
      }

      // 2. 向量检索
      const results = await this.prisma.$queryRawUnsafe<
        Array<{ dishId: string; distance: number }>
      >(
        `
        SELECT 
          de."dishId",
          de.embedding <=> $1::vector AS distance
        FROM "dish_embeddings" de
        INNER JOIN "dishes" d ON de."dishId" = d.id
        WHERE de.version = $2
          AND d.status = 'online'
        ORDER BY distance ASC
        LIMIT $3
        `,
        `[${queryEmbedding.join(',')}]`,
        targetVersion,
        limit,
      );

      return results.map((r) => r.dishId);
    } catch (error) {
      this.logger.error(`Query text vector recall failed: ${error.message}`);
      return [];
    }
  }

  /**
   * 获取指定菜品的向量相似菜品召回（用于"相似推荐"）
   *
   * @param dishId 触发菜品ID
   * @param limit 召回数量
   * @param excludeSelf 是否排除自己
   * @returns 相似菜品ID列表
   */
  async recallSimilarDishesByEmbedding(
    dishId: string,
    limit: number = 50,
    excludeSelf: boolean = true,
  ): Promise<string[]> {
    const dishEmbedding = await this.getDishEmbedding(dishId);
    if (!dishEmbedding) {
      this.logger.warn(`No embedding found for dish ${dishId}`);
      return [];
    }

    try {
      const excludeClause = excludeSelf ? `AND de."dishId" != '${dishId}'` : '';

      const results = await this.prisma.$queryRawUnsafe<
        Array<{ dishId: string; distance: number }>
      >(
        `
        SELECT 
          de."dishId",
          de.embedding <=> $1::vector AS distance
        FROM "dish_embeddings" de
        INNER JOIN "dishes" d ON de."dishId" = d.id
        WHERE de.version = $2
          AND d.status = 'online'
          ${excludeClause}
        ORDER BY distance ASC
        LIMIT $3
        `,
        `[${dishEmbedding.embedding.join(',')}]`,
        dishEmbedding.version,
        limit,
      );

      return results.map((r) => r.dishId);
    } catch (error) {
      this.logger.error(
        `Similar dishes vector recall failed: ${error.message}`,
      );
      return [];
    }
  }

  /**
   * 确保两个嵌入版本一致（低版本升级到高版本）
   * @returns 版本一致的嵌入对，如果升级失败返回 null
   */
  private async ensureVersionCompatibility(
    ve1: VersionedEmbedding,
    ve2: VersionedEmbedding,
    id1?: string,
    id2?: string,
    type1?: 'user' | 'dish',
    type2?: 'user' | 'dish',
  ): Promise<{ e1: number[]; e2: number[] } | null> {
    // 版本相同，直接返回
    if (ve1.version === ve2.version) {
      return { e1: ve1.embedding, e2: ve2.embedding };
    }

    const cmp = this.compareVersions(ve1.version, ve2.version);
    const targetVersion = cmp > 0 ? ve1.version : ve2.version;

    // 升级低版本的嵌入
    if (cmp < 0 && id1) {
      // ve1 版本较低，升级 ve1
      const upgraded =
        type1 === 'dish'
          ? await this.upgradeDishEmbedding(id1, targetVersion)
          : await this.upgradeUserEmbedding(id1, targetVersion);
      if (!upgraded) return null;
      return { e1: upgraded.embedding, e2: ve2.embedding };
    } else if (cmp > 0 && id2) {
      // ve2 版本较低，升级 ve2
      const upgraded =
        type2 === 'dish'
          ? await this.upgradeDishEmbedding(id2, targetVersion)
          : await this.upgradeUserEmbedding(id2, targetVersion);
      if (!upgraded) return null;
      return { e1: ve1.embedding, e2: upgraded.embedding };
    }

    this.logger.warn(
      `Cannot ensure version compatibility: ${ve1.version} vs ${ve2.version}`,
    );
    return null;
  }

  /**
   * 计算用户与菜品的嵌入相似度
   */
  async calculateUserDishSimilarity(
    userId: string,
    dishId: string,
  ): Promise<number> {
    const [userVE, dishVE] = await Promise.all([
      this.getUserEmbedding(userId),
      this.getDishEmbedding(dishId),
    ]);

    if (!userVE || !dishVE) {
      return 0;
    }

    // 版本一致直接计算
    if (userVE.version === dishVE.version) {
      return this.cosineSimilarity(userVE.embedding, dishVE.embedding);
    }

    // 版本不一致，升级菜品嵌入到用户嵌入的版本
    const compatible = await this.ensureVersionCompatibility(
      userVE,
      dishVE,
      userId,
      dishId,
      'user',
      'dish',
    );

    if (!compatible) {
      return 0;
    }

    return this.cosineSimilarity(compatible.e1, compatible.e2);
  }

  /**
   * 批量计算用户与多个菜品的相似度
   */
  async calculateUserDishSimilarities(
    userId: string,
    dishIds: string[],
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();

    let userVE = await this.getUserEmbedding(userId);
    if (!userVE) {
      return result;
    }

    const dishEmbeddings = await this.getDishEmbeddings(dishIds);

    // 找出最高版本
    let maxVersion = userVE.version;
    for (const dishId of dishIds) {
      const dishVE = dishEmbeddings.get(dishId);
      if (dishVE && this.compareVersions(dishVE.version, maxVersion) > 0) {
        maxVersion = dishVE.version;
      }
    }

    // 如果用户嵌入版本较低，先升级用户嵌入
    if (this.compareVersions(userVE.version, maxVersion) < 0) {
      this.logger.debug(`Upgrading user embedding to ${maxVersion}`);
      const upgraded = await this.upgradeUserEmbedding(userId, maxVersion);
      if (upgraded) {
        userVE = upgraded;
      }
    }

    // 找出需要升级的菜品
    const needUpgrade: string[] = [];
    for (const dishId of dishIds) {
      const dishVE = dishEmbeddings.get(dishId);
      if (dishVE && dishVE.version !== userVE.version) {
        if (this.compareVersions(dishVE.version, userVE.version) < 0) {
          needUpgrade.push(dishId);
        }
      }
    }

    // 批量升级菜品
    if (needUpgrade.length > 0) {
      this.logger.debug(
        `Upgrading ${needUpgrade.length} dish embeddings to ${userVE.version}`,
      );
      for (const dishId of needUpgrade) {
        const upgraded = await this.upgradeDishEmbedding(
          dishId,
          userVE.version,
        );
        if (upgraded) {
          dishEmbeddings.set(dishId, upgraded);
        }
      }
    }

    // 计算相似度
    for (const dishId of dishIds) {
      const dishVE = dishEmbeddings.get(dishId);
      if (dishVE && dishVE.version === userVE.version) {
        result.set(
          dishId,
          this.cosineSimilarity(userVE.embedding, dishVE.embedding),
        );
      } else {
        result.set(dishId, 0);
      }
    }

    return result;
  }

  /**
   * 计算两个菜品之间的相似度
   */
  async calculateDishSimilarity(
    dishId1: string,
    dishId2: string,
  ): Promise<number> {
    const [ve1, ve2] = await Promise.all([
      this.getDishEmbedding(dishId1),
      this.getDishEmbedding(dishId2),
    ]);

    if (!ve1 || !ve2) {
      return 0;
    }

    // 版本一致直接计算
    if (ve1.version === ve2.version) {
      return this.cosineSimilarity(ve1.embedding, ve2.embedding);
    }

    // 版本不一致，升级低版本
    const compatible = await this.ensureVersionCompatibility(
      ve1,
      ve2,
      dishId1,
      dishId2,
      'dish',
      'dish',
    );

    if (!compatible) {
      return 0;
    }

    return this.cosineSimilarity(compatible.e1, compatible.e2);
  }

  /**
   * 获取与指定菜品最相似的菜品
   */
  async getSimilarDishes(
    dishId: string,
    candidateDishIds: string[],
    topK: number = 10,
  ): Promise<Array<{ dishId: string; similarity: number }>> {
    const targetVE = await this.getDishEmbedding(dishId);
    if (!targetVE) {
      return [];
    }

    const candidateEmbeddings = await this.getDishEmbeddings(candidateDishIds);

    // 找出需要升级的菜品
    const needUpgrade: string[] = [];
    for (const candidateId of candidateDishIds) {
      if (candidateId === dishId) continue;
      const ve = candidateEmbeddings.get(candidateId);
      if (ve && ve.version !== targetVE.version) {
        if (this.compareVersions(ve.version, targetVE.version) < 0) {
          needUpgrade.push(candidateId);
        }
      }
    }

    // 批量升级
    if (needUpgrade.length > 0) {
      for (const id of needUpgrade) {
        const upgraded = await this.upgradeDishEmbedding(id, targetVE.version);
        if (upgraded) {
          candidateEmbeddings.set(id, upgraded);
        }
      }
    }

    const similarities: Array<{ dishId: string; similarity: number }> = [];

    for (const candidateId of candidateDishIds) {
      if (candidateId === dishId) continue;

      const ve = candidateEmbeddings.get(candidateId);
      if (ve && ve.version === targetVE.version) {
        similarities.push({
          dishId: candidateId,
          similarity: this.cosineSimilarity(targetVE.embedding, ve.embedding),
        });
      }
    }

    // 按相似度降序排序
    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, topK);
  }

  // ==================== 工具方法 ====================

  /**
   * 向量归一化
   */
  private normalizeVector(vec: number[]): number[] {
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0) return vec;
    return vec.map((v) => v / norm);
  }
}
