import { PublicAppModule } from './runtime/public-app.module';
import { bootstrapHttp } from './runtime/http-bootstrap';

void bootstrapHttp(PublicAppModule);
