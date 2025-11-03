import { development } from './env';
import { production } from './env';

// 定义配置类型
interface Config {
  baseUrl: string;
}

let config: Config;

if (process.env.NODE_ENV === 'development') {
  // 开发环境
  config = development;
} else {
  // 生产环境
  config = production;
}

export default config;