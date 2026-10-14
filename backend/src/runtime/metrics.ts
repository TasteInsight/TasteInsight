import {
  Counter,
  Histogram,
  Gauge,
  Registry,
  collectDefaultMetrics,
} from '@prometheus-io/client';
import { Request, Response, NextFunction } from 'express';
import { Queue } from 'bullmq';

export function createMetrics(
  queues: Pick<Queue, 'name' | 'getJobCounts'>[] = [],
) {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry });
  const requests = new Counter({
    name: 'tasteinsight_http_requests_total',
    help: 'Completed HTTP requests',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });
  const duration = new Histogram({
    name: 'tasteinsight_http_duration_seconds',
    help: 'HTTP response duration',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10],
    registers: [registry],
  });
  if (queues.length) {
    let collecting: Promise<void> | undefined;
    const jobs = new Gauge({
      name: 'tasteinsight_queue_jobs',
      help: 'BullMQ jobs by queue and state',
      labelNames: ['queue', 'state'] as const,
      registers: [registry],
      collect() {
        collecting ??= Promise.all(
          queues.map(async (queue) => {
            const counts = await queue.getJobCounts(
              'waiting',
              'active',
              'delayed',
              'failed',
            );
            for (const [state, count] of Object.entries(counts))
              jobs.set({ queue: queue.name, state }, count);
          }),
        )
          .then(() => undefined)
          .finally(() => {
            collecting = undefined;
          });
        return collecting;
      },
    });
  }
  return {
    registry,
    middleware(req: Request, res: Response, next: NextFunction) {
      if (/^\/(health|metrics)\/?$/i.test(req.path)) return next();
      const start = process.hrtime.bigint();
      res.once('finish', () => {
        const route: unknown = req.route?.path;
        const labels = {
          method: [
            'GET',
            'POST',
            'PUT',
            'PATCH',
            'DELETE',
            'HEAD',
            'OPTIONS',
          ].includes(req.method)
            ? req.method
            : 'OTHER',
          route: typeof route === 'string' ? route : 'unmatched',
          status: String(res.statusCode),
        };
        requests.inc(labels);
        // SSE response lifetime measures a stream session, not API response latency.
        if (
          !String(res.getHeader('Content-Type')).includes('text/event-stream')
        ) {
          duration.observe(
            labels,
            Number(process.hrtime.bigint() - start) / 1e9,
          );
        }
      });
      next();
    },
    async handle(_req: Request, res: Response) {
      let deadline: ReturnType<typeof setTimeout> | undefined;
      try {
        const text = await Promise.race([
          registry.metrics(),
          new Promise<never>((_, reject) => {
            deadline = setTimeout(
              () => reject(new Error('Metrics timeout')),
              2500,
            );
          }),
        ]);
        res.type(registry.contentType).send(text);
      } catch {
        res.status(503).send('Metrics unavailable');
      } finally {
        if (deadline) clearTimeout(deadline);
      }
    },
  };
}
