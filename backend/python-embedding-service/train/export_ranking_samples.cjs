/** Export only observed impressions from immutable delivery feature snapshots. */
const { PrismaClient } = require('../../node_modules/@prisma/client');
const { createWriteStream } = require('node:fs');
const { once } = require('node:events');

async function main() {
  const [output, beforeArg] = process.argv.slice(2);
  if (!output || !beforeArg)
    throw new Error(
      'Usage: node train/export_ranking_samples.cjs output.jsonl cutoff-ISO-time',
    );
  const before = new Date(beforeArg);
  if (!Number.isFinite(before.getTime()))
    throw new Error('Invalid cutoff timestamp');
  const prisma = new PrismaClient();
  const stream = createWriteStream(output, { flags: 'wx', mode: 0o600 });
  let cursor;
  let exported = 0;
  try {
    await once(stream, 'open');
    while (true) {
      const deliveries = await prisma.recommendationDelivery.findMany({
        where: {
          createdAt: { lte: new Date(before.getTime() - 24 * 3600 * 1000) },
        },
        orderBy: { id: 'asc' },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          feedback: {
            where: {
              createdAt: { lt: before },
              eventType: { in: ['impression', 'click'] },
            },
          },
        },
      });
      if (!deliveries.length) break;
      for (const delivery of deliveries) {
        const snapshot = delivery.featureSnapshot;
        if (!snapshot?.user || !Array.isArray(snapshot.candidates)) continue;
        const labelWindowEnd = new Date(
          delivery.createdAt.getTime() + 24 * 3600 * 1000,
        );
        const feedback = delivery.feedback.filter(
          (item) => item.createdAt <= labelWindowEnd,
        );
        const impressions = new Set(
          feedback
            .filter((item) => item.eventType === 'impression')
            .map((item) => item.dishId),
        );
        const clicks = new Set(
          feedback
            .filter((item) => item.eventType === 'click')
            .map((item) => item.dishId),
        );
        for (const candidate of snapshot.candidates) {
          if (!impressions.has(candidate.dishId)) continue;
          const line = JSON.stringify({
            deliveryId: delivery.id,
            deliveredAt: delivery.createdAt.toISOString(),
            labelWindowEnd: labelWindowEnd.toISOString(),
            user: snapshot.user,
            candidate,
            label: clicks.has(candidate.dishId) ? 1 : 0,
          });
          if (!stream.write(line + '\n')) await once(stream, 'drain');
          exported += 1;
        }
      }
      cursor = deliveries.at(-1).id;
    }
    stream.end();
    await once(stream, 'finish');
    process.stderr.write(
      `Exported ${exported} observed examples before ${before.toISOString()}\n`,
    );
  } finally {
    stream.destroy();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
