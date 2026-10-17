import { WorkerAppModule } from './runtime/worker-app.module';
import { bootstrapHttp } from './runtime/http-bootstrap';

import { DISH_SYNC_QUEUE } from './dish-sync-queue/dish-sync.constants';
import { DISH_REVIEW_STATS_QUEUE } from './dish-review-stats-queue/dish-review-stats.constants';
import { EMBEDDING_QUEUE } from './embedding-queue/embedding-queue.constants';

void bootstrapHttp(WorkerAppModule, [
  DISH_SYNC_QUEUE,
  DISH_REVIEW_STATS_QUEUE,
  EMBEDDING_QUEUE,
]);
