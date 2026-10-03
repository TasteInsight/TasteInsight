import { createEnvConfig } from './env';

// Vite replaces this expression at build time. Jest reads the same variable at
// runtime, which keeps the configuration contract independently testable.
const config = createEnvConfig(process.env.VITE_API_BASE_URL);

export default config;
