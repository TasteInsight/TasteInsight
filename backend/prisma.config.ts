import { defineConfig } from 'prisma/config';
import { loadDatabaseEnvironment } from './src/database-url';

loadDatabaseEnvironment(process.env, __dirname);

export default defineConfig({ schema: 'prisma/schema.prisma' });
