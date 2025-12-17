import { Injectable, Logger } from '@nestjs/common';
import { hashString } from '../utils/hash.util';
import { DishFeatures, UserFeatures } from '../interfaces';

/**
 * 特征编码器服务
 * 提供统一的特征向量化方法，确保菜品和用户特征在同一空间
 */
@Injectable()
export class FeatureEncoderService {
  private readonly logger = new Logger(FeatureEncoderService.name);

  // 特征维度配置（总维度 = 128）
  private readonly FEATURE_CONFIG = {
    // 类别特征（Multi-hot encoding）
    tags: { start: 0, size: 30 }, // 标签特征
    ingredients: { start: 30, size: 20 }, // 食材特征
    allergens: { start: 50, size: 10 }, // 过敏原特征

    // 数值特征（归一化）
    flavor: { start: 60, size: 4 }, // 口味特征（辣/甜/咸/油）
    price: { start: 64, size: 1 }, // 价格（归一化到0-1）
    quality: { start: 65, size: 2 }, // 质量（评分 + log(评论数)）

    // 地理特征
    canteen: { start: 67, size: 15 }, // 食堂特征

    // 文本特征（TF-IDF风格）
    nameTokens: { start: 82, size: 20 }, // 名称token

    // 行为特征（仅用户）
    behavior: { start: 102, size: 10 }, // 行为模式

    // 预留扩展
    reserved: { start: 112, size: 16 },
  };

  private readonly DIM = 128;

  /**
   * 编码菜品特征为向量
   */
  encodeDishFeatures(feature: DishFeatures): number[] {
    const vector = new Array(this.DIM).fill(0);

    // 1. 标签特征（Multi-hot）
    this.encodeCategories(
      feature.tags || [],
      vector,
      this.FEATURE_CONFIG.tags,
    );

    // 2. 食材特征
    this.encodeCategories(
      feature.ingredients || [],
      vector,
      this.FEATURE_CONFIG.ingredients,
    );

    // 3. 过敏原特征
    this.encodeCategories(
      feature.allergens || [],
      vector,
      this.FEATURE_CONFIG.allergens,
    );

    // 4. 口味特征（归一化到0-1）
    const flavorStart = this.FEATURE_CONFIG.flavor.start;
    vector[flavorStart + 0] = this.normalize(feature.spicyLevel, 0, 5);
    vector[flavorStart + 1] = this.normalize(feature.sweetness, 0, 5);
    vector[flavorStart + 2] = this.normalize(feature.saltiness, 0, 5);
    vector[flavorStart + 3] = this.normalize(feature.oiliness, 0, 5);

    // 5. 价格特征（归一化，假设价格范围0-50元）
    vector[this.FEATURE_CONFIG.price.start] = this.normalize(
      feature.price,
      0,
      50,
    );

    // 6. 质量特征
    const qualityStart = this.FEATURE_CONFIG.quality.start;
    vector[qualityStart + 0] = this.normalize(feature.averageRating, 0, 5);
    // 评论数使用log scale
    vector[qualityStart + 1] =
      feature.reviewCount > 0
        ? Math.log10(feature.reviewCount + 1) / 3 // 假设最大1000条评论
        : 0;

    // 7. 食堂特征
    if (feature.canteenId) {
      this.encodeSingleCategory(
        feature.canteenId,
        vector,
        this.FEATURE_CONFIG.canteen,
      );
    }

    // 8. 名称特征（分词后的token）
    const nameTokens = this.tokenize(feature.name);
    this.encodeCategories(nameTokens, vector, this.FEATURE_CONFIG.nameTokens);

    // 归一化
    return this.normalizeVector(vector);
  }

  /**
   * 编码用户特征为向量
   */
  encodeUserFeatures(userFeatures: UserFeatures): number[] {
    const vector = new Array(this.DIM).fill(0);
    const prefs = userFeatures.preferences;
    const favFeatures = userFeatures.favoriteFeatures;
    const browseFeatures = userFeatures.browseFeatures;

    // 1. 标签偏好（综合偏好设置 + 收藏 + 浏览）
    const allTags: string[] = [];
    if (prefs) allTags.push(...prefs.tagPreferences);

    // 从收藏中提取高频标签
    if (favFeatures.tagWeights.size > 0) {
      const topTags = [...favFeatures.tagWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag]) => tag);
      allTags.push(...topTags);
    }

    // 从浏览中提取近期标签
    if (browseFeatures.tagWeights.size > 0) {
      const recentTags = [...browseFeatures.tagWeights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);
      allTags.push(...recentTags);
    }

    this.encodeCategories(allTags, vector, this.FEATURE_CONFIG.tags);

    // 2. 食材偏好
    const allIngredients: string[] = [];
    if (prefs) {
      allIngredients.push(...prefs.meatPreference);
      allIngredients.push(...prefs.favoriteIngredients);
    }
    allIngredients.push(...favFeatures.ingredients);

    this.encodeCategories(
      allIngredients,
      vector,
      this.FEATURE_CONFIG.ingredients,
    );

    // 避免的食材（负权重）
    if (prefs) {
      prefs.avoidIngredients.forEach((ingredient) => {
        const hash = hashString(ingredient) % this.FEATURE_CONFIG.ingredients.size;
        const idx = this.FEATURE_CONFIG.ingredients.start + hash;
        vector[idx] -= 0.5; // 负向权重
      });
    }

    // 3. 过敏原（强负权重）
    if (userFeatures.allergens && userFeatures.allergens.length > 0) {
      userFeatures.allergens.forEach((allergen) => {
        const hash = hashString(allergen) % this.FEATURE_CONFIG.allergens.size;
        const idx = this.FEATURE_CONFIG.allergens.start + hash;
        vector[idx] = -1.0; // 强负向权重
      });
    }

    // 4. 口味偏好（加权平均：偏好设置70% + 实际行为30%）
    const prefWeight = 0.7;
    const behaviorWeight = 0.3;

    const flavorStart = this.FEATURE_CONFIG.flavor.start;
    vector[flavorStart + 0] = this.normalize(
      (prefs?.spicyLevel || 0) * prefWeight +
        favFeatures.avgSpicyLevel * behaviorWeight,
      0,
      5,
    );
    vector[flavorStart + 1] = this.normalize(
      (prefs?.sweetness || 0) * prefWeight +
        favFeatures.avgSweetness * behaviorWeight,
      0,
      5,
    );
    vector[flavorStart + 2] = this.normalize(
      (prefs?.saltiness || 0) * prefWeight +
        favFeatures.avgSaltiness * behaviorWeight,
      0,
      5,
    );
    vector[flavorStart + 3] = this.normalize(
      (prefs?.oiliness || 0) * prefWeight +
        favFeatures.avgOiliness * behaviorWeight,
      0,
      5,
    );

    // 5. 价格偏好
    const prefAvgPrice = prefs ? (prefs.priceMin + prefs.priceMax) / 2 : 25;
    const avgPrice =
      prefAvgPrice * prefWeight + favFeatures.avgPrice * behaviorWeight;
    vector[this.FEATURE_CONFIG.price.start] = this.normalize(avgPrice, 0, 50);

    // 6. 质量偏好（基于用户收藏的菜品平均评分）
    // 这里假设用户倾向于选择高质量的菜品
    const qualityStart = this.FEATURE_CONFIG.quality.start;
    vector[qualityStart + 0] = 0.7; // 默认倾向于高评分
    vector[qualityStart + 1] = 0.5; // 中等关注度

    // 7. 食堂偏好
    const canteens: string[] = [];
    if (prefs) canteens.push(...prefs.canteenPreferences);
    canteens.push(...favFeatures.canteenIds);
    this.encodeCategories(canteens, vector, this.FEATURE_CONFIG.canteen, 0.6);

    // 8. 行为特征（用户专属）
    const behaviorStart = this.FEATURE_CONFIG.behavior.start;

    // 收藏活跃度
    vector[behaviorStart + 0] = Math.min(
      1.0,
      Math.log10((favFeatures.dishIds.size || 0) + 1) / 2,
    );

    // 浏览活跃度
    vector[behaviorStart + 1] = Math.min(
      1.0,
      Math.log10((browseFeatures.recentDishIds.size || 0) + 1) / 2,
    );

    // 食堂多样性（访问过的不同食堂数量）
    vector[behaviorStart + 2] = Math.min(
      1.0,
      (favFeatures.canteenIds.size || 0) / 10,
    );

    // 菜系多样性（喜欢的标签种类）
    vector[behaviorStart + 3] = Math.min(
      1.0,
      (favFeatures.tagWeights.size || 0) / 20,
    );

    // 归一化
    return this.normalizeVector(vector);
  }

  /**
   * 编码类别特征（Multi-hot encoding with hashing）
   */
  private encodeCategories(
    categories: string[],
    vector: number[],
    config: { start: number; size: number },
    weight: number = 1.0,
  ): void {
    const counts = new Map<number, number>();

    // 统计每个slot的出现次数
    categories.forEach((cat) => {
      const hash = hashString(cat) % config.size;
      counts.set(hash, (counts.get(hash) || 0) + 1);
    });

    // 写入向量（使用TF-IDF风格的权重）
    counts.forEach((count, hash) => {
      const idx = config.start + hash;
      // 使用log scale避免高频词主导
      vector[idx] += Math.log(1 + count) * weight;
    });
  }

  /**
   * 编码单个类别
   */
  private encodeSingleCategory(
    category: string,
    vector: number[],
    config: { start: number; size: number },
    weight: number = 1.0,
  ): void {
    const hash = hashString(category) % config.size;
    vector[config.start + hash] = weight;
  }

  /**
   * 简单的中文分词（基于字符级）
   */
  private tokenize(text: string): string[] {
    if (!text) return [];

    // 移除标点符号
    const cleaned = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ');

    // 分割成词
    const tokens: string[] = [];

    // 提取2-gram（中文）
    for (let i = 0; i < cleaned.length - 1; i++) {
      if (this.isChinese(cleaned[i])) {
        tokens.push(cleaned.substring(i, i + 2));
      }
    }

    // 提取英文单词
    const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
    tokens.push(...words);

    return tokens;
  }

  /**
   * 判断是否为中文字符
   */
  private isChinese(char: string): boolean {
    return /[\u4e00-\u9fa5]/.test(char);
  }

  /**
   * 归一化到[0, 1]
   */
  private normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * 向量L2归一化
   */
  private normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    if (norm === 0 || norm === 1) return vector;
    return vector.map((v) => v / norm);
  }

  /**
   * 计算余弦相似度
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
    }

    // 如果向量已经归一化，点积就是余弦相似度
    return dotProduct;
  }

  /**
   * 获取特征维度
   */
  getDimension(): number {
    return this.DIM;
  }
}

