import { hasId, list } from "../contracts.mjs";
export function browsing(call, s, unique, iteration) {
  call("public", "GET", "/canteens", null, "canteens", list);
  call(
    "public",
    "GET",
    `/canteens/${s.canteenId}/windows`,
    null,
    "windows",
    (d) => list(d) && d.items.some((w) => w.id === s.windowId),
  );
  call("public", "GET", "/news", null, "news", list);
  call(
    "public",
    "GET",
    `/news/${s.newsId}`,
    null,
    "news_detail",
    (d) => d?.id === s.newsId,
  );
  const readId = s.dishIds[iteration % s.dishIds.length];
  call(
    "public",
    "POST",
    "/dishes",
    {
      filter: { canteenId: [s.canteenId] },
      search: { keyword: s.canteenId.split("_").slice(0, 2).join("_") },
      sort: { field: "createdAt", order: "desc" },
      pagination: { page: 1, pageSize: 20 },
    },
    "search",
    (d) => list(d) && d.items.length > 0,
  );
  call(
    "public",
    "POST",
    "/recommend",
    {
      scene: "home",
      filter: { canteenId: [s.canteenId] },
      pagination: { page: 1, pageSize: 10 },
    },
    "recommend",
    (d) => Array.isArray(d?.items),
  );
  call(
    "public",
    "GET",
    `/dishes/${readId}`,
    null,
    "dish_detail",
    (d) => d?.id === readId,
  );
  call(
    "public",
    "POST",
    `/dishes/${readId}/favorite`,
    null,
    "favorite",
    () => true,
  );
  call(
    "public",
    "DELETE",
    `/dishes/${readId}/favorite`,
    null,
    "unfavorite",
    () => true,
  );
}
export function social(call, s) {
  call(
    "public",
    "GET",
    `/dishes/${s.dishId}/reviews`,
    null,
    "reviews",
    (d) => list(d) && d.items.some((x) => x.id === s.reviewId),
  );
  call("public", "GET", `/comments/${s.reviewId}`, null, "comments", list);
  const comment = call(
    "public",
    "POST",
    "/comments",
    { reviewId: s.reviewId, content: "Performance comment" },
    "create_comment",
    (d) => hasId(d) && d.userId === s.user.id && d.reviewId === s.reviewId,
    [201],
  );
  try {
    call(
      "admin",
      "POST",
      `/admin/comments/${comment.id}/approve`,
      {},
      "approve_comment",
      () => true,
    );
    call(
      "public",
      "PUT",
      `/comments/${comment.id}/like`,
      null,
      "like_comment",
      () => true,
      [200],
      s.author,
    );
    call(
      "public",
      "DELETE",
      `/comments/${comment.id}/like`,
      null,
      "unlike_comment",
      () => true,
      [200],
      s.author,
    );
    call(
      "public",
      "POST",
      `/comments/${comment.id}/report`,
      { type: "other", reason: "Performance comment report" },
      "report_comment",
      (d) => d === null,
      [201],
      s.author,
    );
  } finally {
    call(
      "public",
      "DELETE",
      `/comments/${comment.id}`,
      null,
      "delete_comment",
      () => true,
    );
  }
}
export function newReview(call, s) {
  return call(
    "public",
    "POST",
    "/reviews",
    {
      dishId: s.writeDishId,
      rating: 4,
      content: "Performance review",
      images: [],
    },
    "create_review",
    (d) => hasId(d) && d.dishId === s.writeDishId && d.userId === s.user.id,
    [201],
  );
}
export function posting(call, s) {
  const review = newReview(call, s);
  try {
    call(
      "public",
      "GET",
      `/dishes/${s.writeDishId}/reviews/mine`,
      null,
      "own_review",
      (d) => d?.id === review.id,
    );
    call(
      "public",
      "GET",
      "/user/profile",
      null,
      "user_profile",
      (d) => d?.id === s.user.id,
    );
    call(
      "public",
      "GET",
      "/user/reviews?page=1&pageSize=20",
      null,
      "user_reviews",
      list,
    );
  } finally {
    call(
      "public",
      "DELETE",
      `/reviews/${review.id}`,
      null,
      "delete_review",
      () => true,
    );
  }
}
export function planning(call, s) {
  const day = new Date().toISOString().slice(0, 10);
  const plan = call(
    "public",
    "POST",
    "/meal-plans",
    {
      startDate: day,
      endDate: day,
      mealTime: "lunch",
      dishes: [s.dishId],
      isPublic: false,
    },
    "create_plan",
    hasId,
    [201],
  );
  try {
    call(
      "public",
      "GET",
      "/meal-plans",
      null,
      "plans",
      (d) => Array.isArray(d?.items) && d.items.some((x) => x.id === plan.id),
    );
    call(
      "public",
      "PUT",
      `/meal-plans/${plan.id}`,
      { mealTime: "dinner" },
      "update_plan",
      (d) => d?.id === plan.id && d.mealTime === "dinner",
    );
  } finally {
    call(
      "public",
      "DELETE",
      `/meal-plans/${plan.id}`,
      null,
      "delete_plan",
      () => true,
    );
  }
}

export function account(call, s) {
  const profile = call(
    "public",
    "GET",
    "/user/profile",
    null,
    "account_profile",
    (d) =>
      d?.id === s.user.id && typeof d?.settings?.showMealPlans === "boolean",
  );
  try {
    call(
      "public",
      "PUT",
      "/user/profile",
      {
        bio: "Performance account",
        settings: { showMealPlans: !profile.settings.showMealPlans },
      },
      "update_profile_settings",
      (d) => d?.id === s.user.id,
    );
    call(
      "public",
      "GET",
      "/user/profile",
      null,
      "verify_profile_settings",
      (d) =>
        d?.bio === "Performance account" &&
        d.settings.showMealPlans === !profile.settings.showMealPlans,
    );
    call("public", "GET", "/notifications", null, "notifications", list);
  } finally {
    call(
      "public",
      "PUT",
      "/user/profile",
      {
        bio: profile.bio || "",
        settings: { showMealPlans: profile.settings.showMealPlans },
      },
      "restore_profile_settings",
      (d) => d?.id === s.user.id,
    );
  }
}
export function aiSessions(call, s) {
  call("public", "GET", "/ai/suggestions", null, "ai_suggestions", (d) =>
    Array.isArray(d?.suggestions),
  );
  const session = call(
    "public",
    "POST",
    "/ai/sessions",
    {},
    "create_ai_session",
    (d) => typeof d?.sessionId === "string",
    [201],
  );
  try {
    call(
      "public",
      "GET",
      `/ai/sessions/${session.sessionId}/history`,
      null,
      "ai_history",
      (d) => Array.isArray(d?.messages) && d.messages.length === 0,
    );
  } finally {
    call(
      "public",
      "DELETE",
      `/ai/sessions/${session.sessionId}`,
      null,
      "delete_ai_session",
      (d) => d === undefined,
    );
  }
}
