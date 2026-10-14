export function manifest(count = 1) {
  const runId = "perf_0123456789abcdef";
  return {
    version: 1,
    state: "ready",
    runId,
    publicBaseUrl: "http://localhost:3000",
    adminBaseUrl: "http://localhost:3001",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    slots: Array.from({ length: count }, (_, i) => {
      const p = `${runId}_${i}`;
      return {
        canteenId: `${p}_canteen`,
        windowId: `${p}_window`,
        dishId: `${p}_dish`,
        writeDishId: `${p}_write`,
        reviewId: `${p}_review`,
        newsId: `${p}_news`,
        dishIds: [`${p}_dish`, `${p}_read_0`],
        user: {
          id: `${p}_user`,
          token: "fixture-access",
          refreshToken: "fixture-refresh",
        },
        author: { id: `${p}_author`, token: "fixture-author" },
        admin: {
          id: `${p}_admin`,
          token: "fixture-admin",
          username: `fixture_${i}`,
          password: "fixture-password",
        },
      };
    }),
  };
}
