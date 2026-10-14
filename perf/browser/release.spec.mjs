import { test, expect } from "@playwright/test";
import { session, api, seed, observe, waitApi } from "./support.mjs";
const { slot, clientOrigin, adminOrigin, publicBaseUrl, adminBaseUrl } =
  session;
async function resetFavorite() {
  const profile = await api(publicBaseUrl, "/user/profile", slot.user.token);
  if (profile.myFavoriteDishes.includes(slot.dishId))
    await api(
      publicBaseUrl,
      `/dishes/${slot.dishId}/favorite`,
      slot.user.token,
      "DELETE",
    );
}
for (let index = 0; index < session.samples; index++) {
  test.describe(`sample ${index + 1}`, () => {
    test.describe("H5 release", () => {
      test.use({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
      });
      test.beforeEach(async ({ context }) => seed(context, false));
      test("client-home", async ({ page }) => {
        const m = await observe(page, "client-home", index);
        await page.goto(clientOrigin + "/#/pages/index/index");
        await expect(page.locator(".home-content")).toHaveAttribute(
          "aria-busy",
          "false",
        );
        await expect(
          page.locator(".home-heading").filter({ hasText: "今日推荐" }),
        ).toBeVisible();
        await expect(page.locator(".dish-card").first()).toBeVisible();
        const ready = Date.now() - m.startedAt,
          start = Date.now();
        await page.locator(".home-search").click();
        await expect(
          page.getByPlaceholder("搜索菜品或食堂", { exact: true }),
        ).toBeVisible();
        await m.finish(ready, Date.now() - start);
      });
      test("client-search", async ({ page }) => {
        const m = await observe(page, "client-search", index);
        await page.goto(clientOrigin + "/#/pages/search/index");
        const input = page.getByPlaceholder("搜索菜品或食堂", { exact: true });
        await expect(input).toBeVisible();
        const ready = Date.now() - m.startedAt,
          start = Date.now();
        await input.fill(slot.dishId);
        await input.press("Enter");
        const card = page.getByRole("button", {
          name: `查看${slot.dishId}`,
          exact: true,
        });
        await expect(card).toBeVisible();
        await card.click();
        await expect(page.locator(".dish-title")).toHaveText(slot.dishId);
        await expect(page.locator(".dish-content")).toHaveAttribute(
          "aria-busy",
          "false",
        );
        await m.finish(ready, Date.now() - start);
      });
      test("client-detail", async ({ page }) => {
        await resetFavorite();
        const m = await observe(page, "client-detail", index);
        try {
          await page.goto(
            clientOrigin + `/#/pages/dish/index?id=${slot.dishId}`,
          );
          await expect(page.locator(".dish-title")).toHaveText(slot.dishId);
          await expect(page.locator(".dish-content")).toHaveAttribute(
            "aria-busy",
            "false",
          );
          const favorite = page.locator('[aria-label="收藏此菜品"]');
          await expect(favorite).toBeEnabled();
          const ready = Date.now() - m.startedAt,
            start = Date.now();
          const saved = waitApi(
            page,
            `/dishes/${slot.dishId}/favorite`,
            "POST",
          );
          await favorite.click();
          await saved;
          await expect(page.locator('[aria-label="取消收藏"]')).toHaveAttribute(
            "aria-pressed",
            "true",
          );
          expect(
            (await api(publicBaseUrl, "/user/profile", slot.user.token))
              .myFavoriteDishes,
          ).toContain(slot.dishId);
          const removed = waitApi(
            page,
            `/dishes/${slot.dishId}/favorite`,
            "DELETE",
          );
          await page.locator('[aria-label="取消收藏"]').click();
          await removed;
          await expect(
            page.locator('[aria-label="收藏此菜品"]'),
          ).toHaveAttribute("aria-pressed", "false");
          expect(
            (await api(publicBaseUrl, "/user/profile", slot.user.token))
              .myFavoriteDishes,
          ).not.toContain(slot.dishId);
          await m.finish(ready, Date.now() - start);
        } finally {
          await resetFavorite();
        }
      });
    });
    test.describe("admin release", () => {
      test.use({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      });
      test("admin-login", async ({ page }) => {
        const m = await observe(page, "admin-login", index);
        await page.goto(adminOrigin + "/login");
        await expect(page.locator("#username")).toBeVisible();
        const ready = Date.now() - m.startedAt,
          start = Date.now();
        await page.locator("#username").fill(slot.admin.username);
        await page.locator("#password").fill(slot.admin.password);
        const logged = waitApi(page, "/auth/admin/login", "POST");
        await page.locator("button[type=submit]").click();
        await logged;
        await expect(page).toHaveURL(/\/single-add$/);
        await expect(page.getByPlaceholder("例如：水煮肉片")).toBeVisible();
        await m.finish(ready, Date.now() - start);
      });
      test("admin-dishes", async ({ page, context }) => {
        await seed(context, true);
        const m = await observe(page, "admin-dishes", index);
        await page.goto(adminOrigin + "/modify-dish");
        const input = page.getByPlaceholder("搜索菜品名称、标签...");
        await expect(input).toBeVisible();
        await expect(page.locator("tbody tr.table-row").first()).toBeVisible();
        const ready = Date.now() - m.startedAt,
          start = Date.now();
        const search = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === "/api/v1/admin/dishes" &&
            decodeURIComponent(r.url()).includes(slot.dishId),
        );
        await input.fill(slot.dishId);
        await search;
        const row = page.locator("tbody tr").filter({ hasText: slot.dishId });
        await expect(row).toHaveCount(1);
        await row.getByTitle("查看", { exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/view-dish/${slot.dishId}$`));
        await expect(
          page.getByText(slot.dishId, { exact: true }).first(),
        ).toBeVisible();
        await m.finish(ready, Date.now() - start);
      });
      test("admin-edit", async ({ page, context }) => {
        await seed(context, true);
        const original = await api(
          adminBaseUrl,
          `/admin/dishes/${slot.writeDishId}`,
          slot.admin.token,
        );
        const price = Number(original.price) + 0.5;
        const m = await observe(page, "admin-edit", index);
        try {
          await page.goto(adminOrigin + `/edit-dish/${slot.writeDishId}`);
          const input = page.getByPlaceholder("例如：15.00（默认为0）");
          await expect(page.getByPlaceholder("例如：水煮肉片")).toHaveValue(
            original.name,
          );
          await expect(input).toHaveValue(String(Number(original.price)));
          await expect(
            page.getByRole("button", { name: "保存修改", exact: true }),
          ).toBeEnabled();
          const ready = Date.now() - m.startedAt,
            start = Date.now();
          await input.fill(String(price));
          const saved = waitApi(
            page,
            `/admin/dishes/${slot.writeDishId}`,
            "PUT",
          );
          await page
            .getByRole("button", { name: "保存修改", exact: true })
            .click();
          expect((await saved).ok()).toBeTruthy();
          await expect(page).toHaveURL(/\/modify-dish$/);
          expect(
            Number(
              (
                await api(
                  adminBaseUrl,
                  `/admin/dishes/${slot.writeDishId}`,
                  slot.admin.token,
                )
              ).price,
            ),
          ).toBe(price);
          await m.finish(ready, Date.now() - start);
        } finally {
          await api(
            adminBaseUrl,
            `/admin/dishes/${slot.writeDishId}`,
            slot.admin.token,
            "PUT",
            { price: Number(original.price) },
          );
          expect(
            Number(
              (
                await api(
                  adminBaseUrl,
                  `/admin/dishes/${slot.writeDishId}`,
                  slot.admin.token,
                )
              ).price,
            ),
          ).toBe(Number(original.price));
        }
      });
    });
  });
}
