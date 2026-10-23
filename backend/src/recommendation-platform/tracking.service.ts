import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import {
  RecommendationContext,
  UserFeatures,
} from '@/recommendation/interfaces';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { RecommendationResultDto } from '@/recommendation/dto/recommendation-result.dto';
import { canonicalValue } from './strategy-config';

@Injectable()
export class RecommendationTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
  ) {}

  async deliver(
    context: RecommendationContext,
    result: RecommendationResultDto,
    features: UserFeatures,
    elapsedMs: number,
    page: number,
    pageSize: number,
  ) {
    const ids = result.data.items.map((item) => item.id);
    const candidates =
      context.candidateFeatures?.filter((dish) =>
        ids.includes(dish.dishId as string),
      ) ?? [];
    const delivery = await this.prisma.recommendationDelivery.create({
      data: {
        userId: context.userId,
        requestId: context.requestId!,
        scene: context.scene,
        experimentId: context.experimentId,
        groupItemId: context.groupItemId,
        strategyRevisionId: context.policy?.strategyRevisionId,
        indexId: context.policy?.index?.id,
        modelVersionId: context.policy?.index?.modelVersionId,
        rankerVersionId: context.policy?.ranker?.id,
        configDigest: result.data.configDigest!,
        fallbackReason: context.fallbackReason,
        latencyMs: Math.round(elapsedMs),
        items: canonicalValue(
          result.data.items.map((item, index) => ({
            ...item,
            position: (page - 1) * pageSize + index,
          })),
        ),
        featureSnapshot: canonicalValue({
          user: this.embedding.extractUserNumericFeatures(features),
          candidates,
        }),
      },
    });
    return delivery.id;
  }

  async feedback(
    userId: string,
    body: { deliveryId: string; dishId: string; eventType: string },
  ) {
    if (
      !body ||
      typeof body.deliveryId !== 'string' ||
      typeof body.dishId !== 'string' ||
      body.deliveryId.length > 128 ||
      body.dishId.length > 128 ||
      !['impression', 'click', 'favorite', 'review'].includes(body.eventType) ||
      Object.keys(body).some(
        (key) => !['deliveryId', 'dishId', 'eventType'].includes(key),
      )
    )
      throw new BadRequestException('反馈参数无效');
    const delivery = await this.prisma.recommendationDelivery.findFirst({
      where: { id: body.deliveryId, userId },
    });
    if (
      !delivery ||
      !(delivery.items as any[]).some((item) => item.id === body.dishId)
    )
      throw new NotFoundException('推荐下发记录不存在');
    if (Date.now() - delivery.createdAt.getTime() > 7 * 86400000)
      throw new BadRequestException('推荐反馈已超过七天归因窗口');
    if (
      body.eventType === 'favorite' &&
      !(await this.prisma.favoriteDish.findFirst({
        where: { userId, dishId: body.dishId },
      }))
    )
      throw new BadRequestException('请先完成收藏');
    if (
      body.eventType === 'review' &&
      !(await this.prisma.review.findFirst({
        where: { userId, dishId: body.dishId },
      }))
    )
      throw new BadRequestException('请先完成评价');
    return this.prisma.recommendationFeedback.upsert({
      where: { deliveryId_dishId_eventType: body },
      create: body,
      update: {},
    });
  }

  async metrics(experimentId: string, days: number) {
    if (!Number.isInteger(days) || days < 1 || days > 90)
      throw new BadRequestException('统计天数范围为 1 到 90');
    const experiment = await this.prisma.experiment.findUnique({
      where: { id: experimentId },
      include: { groupItems: true },
    });
    if (!experiment) throw new NotFoundException('实验不存在');
    const since = new Date(Date.now() - days * 86400000);
    const rows = await this.prisma.$queryRaw<any[]>`
      WITH per_delivery AS (
        SELECT d.*,
          (SELECT count(*) FROM recommendation_feedback f WHERE f."deliveryId"=d.id AND f."eventType"='impression') AS impressions,
          (SELECT count(*) FROM recommendation_feedback f WHERE f."deliveryId"=d.id AND f."eventType"='click' AND EXISTS (SELECT 1 FROM recommendation_feedback e WHERE e."deliveryId"=d.id AND e."dishId"=f."dishId" AND e."eventType"='impression')) AS clicks,
          (SELECT count(*) FROM recommendation_feedback f WHERE f."deliveryId"=d.id AND f."eventType"='favorite' AND EXISTS (SELECT 1 FROM recommendation_feedback e WHERE e."deliveryId"=d.id AND e."dishId"=f."dishId" AND e."eventType"='impression')) AS favorites
        FROM recommendation_deliveries d WHERE d."experimentId"=${experimentId} AND d."createdAt">=${since}
      )
      SELECT "groupItemId", count(*) AS deliveries, sum(impressions) AS impressions, sum(clicks) AS clicks, sum(favorites) AS favorites,
        count(*) FILTER (WHERE "fallbackReason" IS NOT NULL) AS fallbacks, avg("latencyMs") AS latency
      FROM per_delivery GROUP BY "groupItemId"
    `;
    return {
      metricVersion: 2,
      groups: experiment.groupItems.map((group) => {
        const row = rows.find((r) => r.groupItemId === group.id);
        const impressions = Number(row?.impressions ?? 0),
          clicks = Number(row?.clicks ?? 0),
          favorites = Number(row?.favorites ?? 0);
        return {
          groupItemId: group.id,
          deliveries: Number(row?.deliveries ?? 0),
          impressions,
          clicks,
          favorites,
          ctr: impressions ? clicks / impressions : 0,
          favoriteRate: impressions ? favorites / impressions : 0,
          fallbacks: Number(row?.fallbacks ?? 0),
          avgLatencyMs: Number(row?.latency ?? 0),
        };
      }),
    };
  }
}
