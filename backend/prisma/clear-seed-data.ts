import type { PrismaClient } from '@prisma/client';

export async function clearSeedBusinessData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.operationLog.deleteMany({}),
    // These records reference recreated users/dishes without foreign keys.
    prisma.recommendationEvent.deleteMany({}),
    prisma.userExperimentAssignment.deleteMany({}),
    prisma.dishEmbedding.deleteMany({}),
    prisma.mealPlanDish.deleteMany({}),
    prisma.mealPlan.deleteMany({}),
    prisma.browseHistory.deleteMany({}),
    prisma.favoriteDish.deleteMany({}),
    prisma.report.deleteMany({}),
    prisma.comment.deleteMany({}),
    prisma.review.deleteMany({}),
    prisma.dishUpload.deleteMany({}),
    prisma.dish.deleteMany({}),
    prisma.window.deleteMany({}),
    prisma.floor.deleteMany({}),
    prisma.news.deleteMany({}),
    prisma.adminPermission.deleteMany({}),
    prisma.admin.deleteMany({}),
    prisma.canteen.deleteMany({}),
    // User defaults and AI conversations, and canteen config items, cascade.
    prisma.user.deleteMany({}),
  ]);
}
