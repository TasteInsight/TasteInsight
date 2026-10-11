import { AppModule } from './app.module';
import { bootstrapHttp } from './runtime/http-bootstrap';

if (process.env.NODE_ENV === 'production') {
  throw new Error(
    'Production requires an explicit main.public, main.admin or main.worker entrypoint',
  );
}

void bootstrapHttp(AppModule);
