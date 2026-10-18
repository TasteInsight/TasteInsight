import { hasId, list } from "../contracts.mjs";
import { newReview } from "./client.js";
const ok = () => true;
export function dishStatus(call, s) {
  call(
    "admin",
    "GET",
    `/admin/dishes?canteenId=${s.canteenId}`,
    null,
    "admin_dishes",
    (d) => list(d) && d.items.some((x) => x.id === s.writeDishId),
  );
  try {
    call(
      "admin",
      "PATCH",
      `/admin/dishes/${s.writeDishId}/status`,
      { status: "offline" },
      "dish_offline",
      (d) => d === null,
    );
  } finally {
    call(
      "admin",
      "PATCH",
      `/admin/dishes/${s.writeDishId}/status`,
      { status: "online" },
      "dish_online",
      (d) => d === null,
    );
  }
  call(
    "admin",
    "GET",
    `/admin/dishes/${s.writeDishId}`,
    null,
    "verify_dish_online",
    (d) => d?.status === "online",
  );
}
function createUpload(call, s, name) {
  return call(
    "admin",
    "POST",
    "/admin/dishes",
    {
      name,
      price: 10,
      canteenId: s.canteenId,
      windowId: s.windowId,
      tags: [],
      ingredients: [],
      allergens: [],
      images: [],
      availableMealTime: ["lunch"],
    },
    "create_upload",
    (d) =>
      hasId(d) &&
      d.status === "pending" &&
      d.canteenId === s.canteenId &&
      d.name === name,
    [201],
  );
}
function approveUpload(call, upload, s) {
  call(
    "admin",
    "POST",
    `/admin/dishes/uploads/${upload.id}/approve`,
    { revision: upload.revision || 1 },
    "approve_upload",
    ok,
  );
  const approved = call(
    "admin",
    "GET",
    `/admin/dishes/uploads/${upload.id}`,
    null,
    "approved_upload",
    (d) =>
      d?.status === "approved" &&
      d.canteenId === s.canteenId &&
      typeof d.approvedDishId === "string",
  );
  call(
    "admin",
    "GET",
    `/admin/dishes/${approved.approvedDishId}`,
    null,
    "approved_dish_ownership",
    (d) => d?.canteenId === s.canteenId && d.name === upload.name,
  );
  return approved;
}
export function uploads(call, s, unique) {
  const first = createUpload(call, s, unique);
  const approved = approveUpload(call, first, s);
  call(
    "admin",
    "DELETE",
    `/admin/dishes/${approved.approvedDishId}`,
    null,
    "delete_approved_dish",
    ok,
  );
  const second = createUpload(call, s, `${unique}_reject`);
  call(
    "admin",
    "POST",
    `/admin/dishes/uploads/${second.id}/reject`,
    { reason: "Performance test", revision: second.revision || 1 },
    "reject_upload",
    ok,
  );
  call(
    "admin",
    "GET",
    `/admin/dishes/uploads/${second.id}`,
    null,
    "rejected_upload",
    (d) => d?.status === "rejected",
  );
}
export function dishLifecycle(call, s, unique) {
  const uploaded = createUpload(call, s, unique);
  const approved = approveUpload(call, uploaded, s);
  try {
    call(
      "admin",
      "GET",
      `/admin/dishes/${approved.approvedDishId}`,
      null,
      "admin_dish_detail",
      (d) => d?.id === approved.approvedDishId,
    );
    call(
      "admin",
      "PUT",
      `/admin/dishes/${approved.approvedDishId}`,
      { price: 12 },
      "update_dish",
      (d) => d?.price === 12,
    );
  } finally {
    call(
      "admin",
      "DELETE",
      `/admin/dishes/${approved.approvedDishId}`,
      null,
      "delete_dish",
      ok,
    );
  }
}
export function canteenManage(call, s) {
  call("admin", "GET", "/admin/canteens", null, "admin_canteens", list);
  call(
    "admin",
    "GET",
    "/admin/news",
    null,
    "admin_news",
    (d) => list(d) && d.items.some((n) => n.id === s.newsId),
  );
  call(
    "admin",
    "GET",
    `/admin/canteens/${s.canteenId}`,
    null,
    "admin_canteen",
    (d) => d?.id === s.canteenId,
  );
  const runId = s.canteenId.split("_").slice(0, 2).join("_");
  try {
    call(
      "admin",
      "PUT",
      `/admin/canteens/${s.canteenId}`,
      { position: "Performance position" },
      "update_canteen",
      (d) => d?.id === s.canteenId,
    );
    call(
      "admin",
      "PUT",
      `/admin/windows/${s.windowId}`,
      { name: "Performance window", description: "Performance window update" },
      "update_window",
      (d) => d?.id === s.windowId,
    );
  } finally {
    call(
      "admin",
      "PUT",
      `/admin/canteens/${s.canteenId}`,
      { position: "" },
      "restore_canteen",
      ok,
    );
    call(
      "admin",
      "PUT",
      `/admin/windows/${s.windowId}`,
      { name: "Performance window", description: runId },
      "restore_window",
      ok,
    );
  }
}
export function permissionLifecycle(call, s, unique) {
  const username = unique.replace(/_/g, "").slice(-19);
  const admin = call(
    "admin",
    "POST",
    "/admin/admins",
    {
      username,
      password: s.admin.password,
      canteenId: s.canteenId,
      permissions: ["dish:view"],
    },
    "create_admin",
    (d) =>
      hasId(d) && d.createdBy === s.admin.id && d.canteenId === s.canteenId,
    [201],
  );
  try {
    call(
      "admin",
      "PUT",
      `/admin/admins/${admin.id}/permissions`,
      { permissions: ["dish:view", "canteen:view", "dish:edit"] },
      "update_admin_permissions",
      ok,
    );
    call(
      "admin",
      "POST",
      "/auth/admin/login",
      { username, password: s.admin.password },
      "subadmin_login",
      (d) =>
        typeof d?.token?.accessToken === "string" && d?.admin?.id === admin.id,
    );
  } finally {
    call(
      "admin",
      "DELETE",
      `/admin/admins/${admin.id}`,
      null,
      "delete_admin",
      ok,
    );
  }
}
function pendingReview(call, s, id) {
  const data = call(
    "admin",
    "GET",
    "/admin/reviews/pending?pageSize=100",
    null,
    "pending_review_version",
    (d) =>
      list(d) &&
      d.items.some(
        (x) =>
          x.id === id &&
          x.userId === s.user.id &&
          typeof x.updatedAt === "string",
      ),
  );
  return data.items.find((x) => x.id === id);
}
export function reviewAudit(call, s) {
  const review = newReview(call, s);
  try {
    const current = pendingReview(call, s, review.id);
    call(
      "admin",
      "POST",
      `/admin/reviews/${review.id}/approve`,
      { expectedUpdatedAt: current.updatedAt },
      "approve_review",
      ok,
    );
    call(
      "public",
      "GET",
      `/dishes/${s.writeDishId}/reviews/mine`,
      null,
      "approved_review",
      (d) => d?.id === review.id && d.status === "approved",
    );
    newReview(call, s);
    const updated = pendingReview(call, s, review.id);
    call(
      "admin",
      "POST",
      `/admin/reviews/${review.id}/reject`,
      { expectedUpdatedAt: updated.updatedAt, reason: "Performance test" },
      "reject_review",
      ok,
    );
    call(
      "public",
      "GET",
      `/dishes/${s.writeDishId}/reviews/mine`,
      null,
      "rejected_review",
      (d) => d?.status === "rejected",
    );
  } finally {
    call(
      "public",
      "DELETE",
      `/reviews/${review.id}`,
      null,
      "cleanup_review",
      ok,
    );
  }
}
export function moderation(call, s) {
  const review = newReview(call, s);
  try {
    const current = pendingReview(call, s, review.id);
    call(
      "admin",
      "POST",
      `/admin/reviews/${review.id}/approve`,
      { expectedUpdatedAt: current.updatedAt },
      "publish_report_target",
      ok,
    );
    const reportId = call(
      "public",
      "POST",
      `/reviews/${review.id}/report`,
      { type: "other", reason: "Performance test" },
      "report_review",
      (d) => typeof d === "string",
      [201],
      s.author,
    );
    call(
      "admin",
      "GET",
      "/admin/reports?pageSize=100&status=pending",
      null,
      "pending_reports",
      (d) => list(d) && d.items.some((r) => r.id === reportId),
    );
    call(
      "admin",
      "POST",
      `/admin/reports/${reportId}/handle`,
      { action: "reject_report", result: "Performance test" },
      "handle_report",
      ok,
    );
  } finally {
    call(
      "public",
      "DELETE",
      `/reviews/${review.id}`,
      null,
      "cleanup_report_target",
      ok,
    );
  }
}
export function contentModeration(call, s) {
  const comment = call(
    "public",
    "POST",
    "/comments",
    { reviewId: s.reviewId, content: "Performance moderation" },
    "content_comment",
    (d) => hasId(d) && d.reviewId === s.reviewId && d.userId === s.user.id,
    [201],
  );
  call(
    "admin",
    "DELETE",
    `/admin/comments/${comment.id}`,
    null,
    "admin_delete_comment",
    ok,
  );
  const review = newReview(call, s);
  call(
    "admin",
    "DELETE",
    `/admin/reviews/${review.id}`,
    null,
    "admin_delete_review",
    ok,
  );
}
