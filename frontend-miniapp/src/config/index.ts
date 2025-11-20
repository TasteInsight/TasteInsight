import { development } from './env';
import { production } from './env';
import { mock } from './env';


// 定义配置类型
interface Config {
  baseUrl: string;
}

let config: Config;


if (process.env.NODE_ENV === 'mock') {
  // Mock环境
  config = mock;
}
else if (process.env.NODE_ENV === 'development') {
  // 开发环境
  config = mock;
} else {
  // 生产环境
  config = production;
}

export default config;