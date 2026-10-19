export class NewsDto {
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourcePublishedAt?: Date | null;
  id: string;
  title: string;
  content: string;
  summary: string;
  canteenId: string;
  canteenName: string;
  createdBy: string;
  publishedAt: string;
  createdAt: string;
}
