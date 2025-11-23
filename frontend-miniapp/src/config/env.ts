interface EnvConfig {
  baseUrl: string;
}

export const development: EnvConfig = {
  // 开发环境
  baseUrl: 'http://localhost:3000',
};

export const production: EnvConfig = {
  // 生产环境
  baseUrl: 'https://prod.api.your-app.com/api/v1', 
};

export const mock: EnvConfig = {
  // Mock环境
  baseUrl: 'http://127.0.0.1:4523/m1/7308714-7037640-6423176',
};