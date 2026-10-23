import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, RecommendationStrategy } from '@prisma/client';
import Ajv from 'ajv';
import { PrismaService } from '@/prisma.service';
import { RecommendationStoreService } from '@/recommendation-store/recommendation-store.service';
import { RecommendationIndexSyncService } from '@/recommendation-store/recommendation-index-sync.service';
import { ModelRuntimeService } from './model-runtime.service';
import { StrategyConfig } from './contracts';
import {
  canonicalValue,
  digest,
  isRuleBaseline,
  parseStrategy,
  scenes,
} from './strategy-config';
import { controlTransaction } from './control-transaction';

const modelValidator = new Ajv({
  strictNumbers: true,
}).compile<Prisma.RecommendationModelUncheckedCreateInput>({
  type: 'object',
  additionalProperties: false,
  required: [
    'name',
    'kind',
    'provider',
    'serviceVersion',
    'artifactDigest',
    'featureSchemaVersion',
  ],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    kind: { enum: ['embedding', 'ranking'] },
    provider: { enum: ['local', 'http'] },
    serviceVersion: { type: 'string', minLength: 1, maxLength: 128 },
    artifactDigest: { type: 'string', minLength: 1, maxLength: 256 },
    featureSchemaVersion: { enum: ['dish-user-v1', 'ranking-numeric-v1'] },
    dimension: { type: 'integer', minimum: 1, maximum: 2000 },
    deploymentId: { type: 'string', minLength: 1, maxLength: 100 },
  },
});

@Injectable()
export class RecommendationCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly store: RecommendationStoreService,
    private readonly sync: RecommendationIndexSyncService,
    private readonly models: ModelRuntimeService,
  ) {}

  async catalog() {
    const [models, indexes, strategies, defaults] = await Promise.all([
      this.prisma.recommendationModel.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recommendationIndex.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recommendationStrategy.findMany({
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.recommendationSceneDefault.findMany(),
    ]);
    const deployments = Object.keys(
      JSON.parse(
        this.config.get<string>('RECOMMENDATION_MODEL_DEPLOYMENTS', '{}'),
      ),
    );
    return {
      models,
      indexes: await Promise.all(
        indexes.map(async (index) => ({
          ...index,
          ...(await this.sync.progress(index.id)),
        })),
      ),
      strategies,
      defaults,
      deployments,
      storeConfigured: this.store.isConfigured(),
    };
  }

  async createModel(body: any) {
    if (!modelValidator(body))
      throw new BadRequestException('模型字段、维度或特征版本无效');
    if (
      body.featureSchemaVersion !==
      (body.kind === 'ranking' ? 'ranking-numeric-v1' : 'dish-user-v1')
    )
      throw new BadRequestException('模型与输入特征契约不匹配');
    if (
      body.provider === 'local' &&
      (body.kind !== 'embedding' ||
        body.serviceVersion !== 'local-v1' ||
        body.artifactDigest !== 'local-v1' ||
        body.dimension !== 128 ||
        body.deploymentId)
    )
      throw new BadRequestException('本地模型使用 local-v1、128 维和固定身份');
    if (body.kind === 'embedding' && !body.dimension)
      throw new BadRequestException('嵌入模型需要维度');
    if (body.kind === 'ranking' && body.dimension !== undefined)
      throw new BadRequestException('排序模型使用评分协议');
    if (body.provider === 'http') {
      const deployments = JSON.parse(
        this.config.get<string>('RECOMMENDATION_MODEL_DEPLOYMENTS', '{}'),
      );
      if (
        !body.deploymentId ||
        !Object.hasOwn(deployments, String(body.deploymentId))
      )
        throw new BadRequestException('请选择已部署的模型服务');
    }
    return this.prisma.recommendationModel.create({
      data: body as unknown as Prisma.RecommendationModelUncheckedCreateInput,
    });
  }

  async verifyModel(id: string) {
    const model = await this.prisma.recommendationModel.findUnique({
      where: { id },
    });
    if (!model) throw new NotFoundException('模型不存在');
    await this.models.verify(model);
    return this.prisma.recommendationModel.update({
      where: { id },
      data: { status: 'ready', verifiedAt: new Date() },
    });
  }

  async createIndex(body: { name: string; modelVersionId: string }) {
    if (!this.store.isConfigured())
      throw new ServiceUnavailableException('请配置独立推荐数据库');
    if (
      !body ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 120 ||
      typeof body.modelVersionId !== 'string' ||
      Object.keys(body).some((k) => !['name', 'modelVersionId'].includes(k))
    )
      throw new BadRequestException('索引参数无效');
    const model = await this.prisma.recommendationModel.findUnique({
      where: { id: body.modelVersionId },
    });
    if (!model || model.status !== 'ready' || model.kind !== 'embedding')
      throw new BadRequestException('索引需要已验证的嵌入模型');
    await this.models.verify(model);
    return this.prisma.recommendationIndex.create({ data: body });
  }

  async rebuildIndex(id: string) {
    return controlTransaction(this.prisma, async (tx) => {
      const index = await tx.recommendationIndex.findUnique({ where: { id } });
      if (!index) throw new NotFoundException('索引不存在');
      if (index.status === 'retired')
        throw new ConflictException('已退役索引，请创建新索引');
      const rebuilding = await tx.recommendationIndex.update({
        where: { id },
        data: {
          generation: { increment: 1 },
          status: 'building',
          lastError: null,
        },
      });
      await tx.recommendationIndexTask.deleteMany({ where: { indexId: id } });
      return rebuilding;
    });
  }

  async retireIndex(id: string) {
    return controlTransaction(this.prisma, async (tx) => {
      const index = await tx.recommendationIndex.findUnique({ where: { id } });
      if (!index) throw new NotFoundException('索引不存在');
      const references = await tx.recommendationStrategy.findMany({
        where: { status: { in: ['published', 'draft'] } },
      });
      if (
        references.some(
          (s) => (s.config as unknown as StrategyConfig).recall.indexId === id,
        )
      )
        throw new ConflictException('仍有策略引用此索引');
      return tx.recommendationIndex.update({
        where: { id },
        data: { status: 'retired' },
      });
    });
  }

  async createStrategy(body: { name: string; scene: string; config: unknown }) {
    if (
      !body ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 120 ||
      Object.keys(body).some((k) => !['name', 'scene', 'config'].includes(k))
    )
      throw new BadRequestException('策略参数无效');
    const config = parseStrategy(body.config, body.scene);
    return this.prisma.recommendationStrategy.create({
      data: {
        name: body.name,
        scene: body.scene,
        config: canonicalValue(config),
      },
    });
  }

  async updateStrategy(id: string, body: { name?: string; config: unknown }) {
    if (
      !body ||
      Object.keys(body).some((k) => !['name', 'config'].includes(k)) ||
      (body.name !== undefined &&
        (typeof body.name !== 'string' ||
          !body.name.trim() ||
          body.name.length > 120))
    )
      throw new BadRequestException('策略参数无效');
    return controlTransaction(this.prisma, async (tx) => {
      const strategy = await tx.recommendationStrategy.findUnique({
        where: { id },
      });
      if (!strategy) throw new NotFoundException('策略不存在');
      if (strategy.status !== 'draft')
        throw new ConflictException('发布后的策略保持不可变，请创建新草稿');
      return tx.recommendationStrategy.update({
        where: { id },
        data: {
          name: body.name,
          config: canonicalValue(parseStrategy(body.config, strategy.scene)),
        },
      });
    });
  }

  async validateReferences(
    tx: Prisma.TransactionClient,
    strategy: Pick<RecommendationStrategy, 'id' | 'scene' | 'config'>,
  ): Promise<StrategyConfig> {
    const config = parseStrategy(strategy.config, strategy.scene);
    if (config.recall.indexId) {
      const index = await tx.recommendationIndex.findUnique({
        where: { id: config.recall.indexId },
        include: { model: true },
      });
      if (!index || index.status !== 'ready' || index.model.status !== 'ready')
        throw new BadRequestException('向量索引及其模型须处于就绪状态');
    }
    if (config.ranking.type === 'model_endpoint') {
      const model = await tx.recommendationModel.findUnique({
        where: { id: config.ranking.modelVersionId },
      });
      if (!model || model.kind !== 'ranking' || model.status !== 'ready')
        throw new BadRequestException('排序模型须处于就绪状态');
    }
    if (config.fallbackStrategyRevisionId) {
      if (config.fallbackStrategyRevisionId === strategy.id)
        throw new BadRequestException('回退策略不能引用自身');
      const fallback = await tx.recommendationStrategy.findUnique({
        where: { id: config.fallbackStrategyRevisionId },
      });
      if (
        !fallback ||
        fallback.status !== 'published' ||
        fallback.scene !== strategy.scene ||
        !isRuleBaseline(parseStrategy(fallback.config, fallback.scene))
      )
        throw new BadRequestException('回退须选择同场景已发布的规则基线');
    }
    return config;
  }

  async publishStrategy(id: string) {
    return controlTransaction(this.prisma, async (tx) => {
      const strategy = await tx.recommendationStrategy.findUnique({
        where: { id },
      });
      if (!strategy) throw new NotFoundException('策略不存在');
      if (strategy.status !== 'draft')
        throw new ConflictException('仅草稿可以发布');
      const config = await this.validateReferences(tx, strategy);
      return tx.recommendationStrategy.update({
        where: { id },
        data: {
          config: canonicalValue(config),
          digest: digest({ scene: strategy.scene, config }),
          status: 'published',
          publishedAt: new Date(),
        },
      });
    });
  }

  async setDefault(scene: string, id: string, adminId: string) {
    if (!scenes.includes(scene as any) || typeof id !== 'string' || !id)
      throw new BadRequestException('场景或策略无效');
    return controlTransaction(this.prisma, async (tx) => {
      const strategy = await tx.recommendationStrategy.findUnique({
        where: { id },
      });
      if (
        !strategy ||
        strategy.status !== 'published' ||
        strategy.scene !== scene
      )
        throw new BadRequestException('请选择本场景已发布策略');
      await this.validateReferences(tx, strategy);
      const previous = await tx.recommendationSceneDefault.findUnique({
        where: { scene },
      });
      await tx.operationLog.create({
        data: {
          adminId,
          action: 'recommendation:default',
          targetType: 'recommendation-strategy',
          targetId: id,
          result: 'success',
          details: {
            scene,
            before: previous?.strategyRevisionId ?? null,
            after: id,
          },
        },
      });
      return tx.recommendationSceneDefault.upsert({
        where: { scene },
        create: { scene, strategyRevisionId: id },
        update: { strategyRevisionId: id },
      });
    });
  }

  async retireStrategy(id: string) {
    return controlTransaction(this.prisma, async (tx) => {
      const [strategy, defaults, groups, fallbacks] = await Promise.all([
        tx.recommendationStrategy.findUnique({ where: { id } }),
        tx.recommendationSceneDefault.count({
          where: { strategyRevisionId: id },
        }),
        tx.experimentGroupItem.count({
          where: {
            strategyRevisionId: id,
            experiment: { status: { in: ['draft', 'running', 'paused'] } },
          },
        }),
        tx.recommendationStrategy.findMany({
          where: { status: { in: ['draft', 'published'] } },
        }),
      ]);
      if (!strategy) throw new NotFoundException('策略不存在');
      if (
        defaults ||
        groups ||
        fallbacks.some(
          (s) =>
            (s.config as unknown as StrategyConfig)
              .fallbackStrategyRevisionId === id,
        )
      )
        throw new ConflictException('策略仍被默认配置、实验或回退引用');
      return tx.recommendationStrategy.update({
        where: { id },
        data: { status: 'retired' },
      });
    });
  }
}
