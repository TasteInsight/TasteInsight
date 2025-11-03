interface EnvConfig {
  baseUrl: string;
}

export const development: EnvConfig = {
  // 开发环境
  baseUrl: 'http://127.0.0.1:8080/api/v1',
};

export const production: EnvConfig = {
  // 生产环境
  baseUrl: 'https://prod.api.your-app.com/api/v1', 
};