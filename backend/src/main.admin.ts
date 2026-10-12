import { AdminAppModule } from './runtime/admin-app.module';
import { bootstrapHttp } from './runtime/http-bootstrap';

void bootstrapHttp(AdminAppModule);
