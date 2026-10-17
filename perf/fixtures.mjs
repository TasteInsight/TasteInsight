import { createRequire } from "node:module";
import { validateOwnership } from "./config.mjs";
import { randomBytes } from "node:crypto";
const require = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const { PrismaClient } = require("@prisma/client");
const { JwtService } = require("@nestjs/jwt");
const bcrypt = require("bcrypt");

export function fixtureDatabase(url) {
  const parsed = new URL(url);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !/^\/tasteinsight_perf_[a-f0-9]{16}$/.test(parsed.pathname)
  )
    throw new Error(
      "Fixture provisioning requires a dedicated tasteinsight_perf_<16 hex> database",
    );
  return new PrismaClient({ datasources: { db: { url } } });
}
export async function provision(
  db,
  {
    runId,
    publicBaseUrl,
    adminBaseUrl,
    count,
    accessSecret,
    refreshSecret,
    lifetimeSeconds = 86400,
    dishesPerSlot = 20,
    onProgress = () => {},
  },
) {
  if (
    !/^perf_[a-f0-9]{16}$/.test(runId) ||
    !Number.isInteger(count) ||
    count < 1
  )
    throw new Error("Invalid fixture run/count");
  if (!Number.isSafeInteger(dishesPerSlot) || dishesPerSlot < 1)
    throw new Error("Invalid fixture dataset size");
  const expiresAtSeconds = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const expiresAt = new Date(expiresAtSeconds * 1000).toISOString();
  const jwt = new JwtService();
  const password = `P!a7${randomBytes(18).toString("hex")}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const actor = (id, type) => ({
    id,
    token: jwt.sign(
      { sub: id, type, tokenUse: "access", exp: expiresAtSeconds },
      { secret: accessSecret },
    ),
    refreshToken: jwt.sign(
      { sub: id, type, tokenUse: "refresh", exp: expiresAtSeconds },
      { secret: refreshSecret },
    ),
  });
  const slots = [];
  for (let i = 0; i < count; i++) {
    const prefix = `${runId}_${i}`;
    const slot = {
      canteenId: `${prefix}_canteen`,
      windowId: `${prefix}_window`,
      dishId: `${prefix}_dish`,
      writeDishId: `${prefix}_write`,
      reviewId: `${prefix}_review`,
      newsId: `${prefix}_news`,
      user: actor(`${prefix}_user`, "user"),
      author: actor(`${prefix}_author`, "user"),
      admin: {
        ...actor(`${prefix}_admin`, "admin"),
        username: `p${runId.slice(5, 13)}_${i}`,
        password,
      },
    };
    slot.dishIds = [
      slot.dishId,
      ...Array.from(
        { length: dishesPerSlot - 1 },
        (_, n) => `${prefix}_read_${n}`,
      ),
    ];
    slots.push(slot);
    await onProgress({
      version: 1,
      state: "preparing",
      runId,
      publicBaseUrl,
      adminBaseUrl,
      expiresAt,
      slots,
    });
    await db.$transaction(
      async (tx) => {
        await tx.canteen.create({
          data: {
            id: slot.canteenId,
            name: slot.canteenId,
            description: runId,
            images: [],
            openingHours: [],
          },
        });
        await tx.adminConfig.create({
          data: {
            canteenId: slot.canteenId,
            items: {
              create: ["review.autoApprove", "comment.autoApprove"].map(
                (key) => ({ key, value: "false", valueType: "boolean" }),
              ),
            },
          },
        });
        await tx.window.create({
          data: {
            id: slot.windowId,
            canteenId: slot.canteenId,
            name: "Performance window",
            number: "1",
            description: runId,
            tags: [],
          },
        });
        for (const user of [slot.user, slot.author])
          await tx.user.create({
            data: {
              id: user.id,
              nickname: user.id,
              bio: "",
              preferences: { create: {} },
              settings: { create: {} },
              studentVerification: {
                create: {
                  status: "VERIFIED",
                  method: "MANUAL",
                  verifiedAt: new Date(),
                  expiresAt: new Date(Date.now() + lifetimeSeconds * 1000),
                },
              },
            },
          });
        await tx.admin.create({
          data: {
            id: slot.admin.id,
            username: slot.admin.username,
            password: passwordHash,
            role: "superadmin",
            canteenId: slot.canteenId,
          },
        });
        await tx.news.create({
          data: {
            id: slot.newsId,
            title: slot.newsId,
            content: "Performance fixture announcement",
            canteenId: slot.canteenId,
            canteenName: slot.canteenId,
            createdBy: slot.admin.id,
            status: "published",
            publishedAt: new Date(),
          },
        });
        for (const id of [...slot.dishIds, slot.writeDishId])
          await tx.dish.create({
            data: {
              id,
              name: id,
              description: runId,
              tags: ["perf"],
              price: 10,
              images: [],
              ingredients: ["rice"],
              allergens: [],
              canteenId: slot.canteenId,
              canteenName: slot.canteenId,
              windowId: slot.windowId,
              windowName: "Performance window",
              availableMealTime: ["lunch", "dinner"],
              status: "online",
            },
          });
        await tx.review.create({
          data: {
            id: slot.reviewId,
            dishId: slot.dishId,
            userId: slot.author.id,
            rating: 4,
            content: runId,
            images: [],
            status: "approved",
          },
        });
      },
      { timeout: 30000 },
    );
  }
  return {
    version: 1,
    state: "ready",
    runId,
    publicBaseUrl,
    adminBaseUrl,
    expiresAt,
    slots,
  };
}
export async function cleanup(db, manifest) {
  validateOwnership(manifest);
  const canteens = manifest.slots.map((s) => s.canteenId);
  const users = manifest.slots.flatMap((s) => [s.user.id, s.author.id]);
  const roots = manifest.slots.map((s) => s.admin.id);
  // Verify ownership before deleting any row, including rows created through APIs.
  const rows = await db.canteen.findMany({ where: { id: { in: canteens } } });
  if (rows.some((row) => row.description !== manifest.runId))
    throw new Error("Fixture ownership mismatch during cleanup");
  await db.$transaction(
    async (tx) => {
      const children = await tx.admin.findMany({
        where: { createdBy: { in: roots } },
        select: { id: true },
      });
      const admins = roots.concat(children.map((a) => a.id));
      await tx.notification.deleteMany({
        where: { OR: [{ userId: { in: users } }, { actorId: { in: users } }] },
      });
      await tx.report.deleteMany({
        where: {
          OR: [{ reporterId: { in: users } }, { handledBy: { in: admins } }],
        },
      });
      await tx.recommendationEvent.deleteMany({
        where: { userId: { in: users } },
      });
      await tx.userExperimentAssignment.deleteMany({
        where: { userId: { in: users } },
      });
      const dishes = await tx.dish.findMany({
        where: { canteenId: { in: canteens } },
        select: { id: true },
      });
      await tx.dishEmbedding.deleteMany({
        where: { dishId: { in: dishes.map((d) => d.id) } },
      });
      await tx.comment.deleteMany({ where: { userId: { in: users } } });
      await tx.review.deleteMany({ where: { userId: { in: users } } });
      await tx.mealPlan.deleteMany({ where: { userId: { in: users } } });
      await tx.favoriteDish.deleteMany({ where: { userId: { in: users } } });
      await tx.browseHistory.deleteMany({ where: { userId: { in: users } } });
      await tx.dishUpload.updateMany({
        where: { canteenId: { in: canteens } },
        data: { parentUploadId: null, parentDishId: null },
      });
      await tx.dishUpload.deleteMany({
        where: { canteenId: { in: canteens } },
      });
      await tx.news.deleteMany({ where: { createdBy: { in: admins } } });
      await tx.aISession.deleteMany({ where: { userId: { in: users } } });
      await tx.operationLog.deleteMany({ where: { adminId: { in: admins } } });
      await tx.admin.updateMany({
        where: { id: { in: admins } },
        data: { createdBy: null },
      });
      await tx.admin.deleteMany({ where: { id: { in: admins } } });
      await tx.canteen.deleteMany({ where: { id: { in: canteens } } });
      await tx.user.deleteMany({ where: { id: { in: users } } });
    },
    { timeout: 30000 },
  );
}
