const { resolve } = require('path');
const { config } = require('dotenv');
const validateTestEnvironment = require('../scripts/test-environment.cjs');

const result = config({
  path: resolve(__dirname, '../.env.test'),
  quiet: true,
});
if (result.error && result.error.code !== 'ENOENT') {
  throw new Error('Unable to read .env.test');
}
validateTestEnvironment(process.env);
