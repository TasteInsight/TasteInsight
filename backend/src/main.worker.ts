import { WorkerAppModule } from './runtime/worker-app.module';
import { bootstrapHttp } from './runtime/http-bootstrap';

void bootstrapHttp(WorkerAppModule);
