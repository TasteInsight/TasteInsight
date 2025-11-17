// Prisma configuration file
// See: https://pris.ly/prisma-config

import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: './prisma/schema.prisma',
  seed: 'ts-node prisma/seed.ts',
});
