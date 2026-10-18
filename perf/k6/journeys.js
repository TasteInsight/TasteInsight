import * as client from "./client.js";
import * as admin from "./admin.js";
export const journeys = {
  browsing: client.browsing,
  account: client.account,
  aiSessions: client.aiSessions,
  social: client.social,
  posting: client.posting,
  planning: client.planning,
  dishStatus: admin.dishStatus,
  uploads: admin.uploads,
  moderation: admin.moderation,
  dishLifecycle: admin.dishLifecycle,
  canteenManage: admin.canteenManage,
  permissionLifecycle: admin.permissionLifecycle,
  reviewAudit: admin.reviewAudit,
  contentModeration: admin.contentModeration,
};
export const journeyNames = Object.keys(journeys);
