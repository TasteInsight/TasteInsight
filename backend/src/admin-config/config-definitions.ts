/**
 * 配置模板定义
 *
 * 这个文件定义了所有系统配置项的模板。
 * 当数据库中没有对应的配置模板时，系统会使用这里定义的默认值作为后备。
 * 同时，系统启动时会自动同步这些定义到数据库。
 *
 * 添加新配置项的步骤：
 * 1. 在 CONFIG_DEFINITIONS 中添加新的配置定义
 * 2. 在 ConfigKeys 中添加对应的常量
 * 3. 系统会在下次启动时自动创建对应的数据库模板
 */

export interface ConfigDefinition {
  key: string;
  defaultValue: string;
  valueType: 'boolean' | 'string' | 'number' | 'json';
  description: string;
  category: string;
}

/**
 * 配置键常量
 */
export const ConfigKeys = {
  // 评价相关
  REVIEW_AUTO_APPROVE: 'review.autoApprove',

  // 评论相关
  COMMENT_AUTO_APPROVE: 'comment.autoApprove',

  // 未来可以添加更多配置键...
  // DISH_MAX_IMAGES: 'dish.maxImages',
  // USER_DEFAULT_AVATAR: 'user.defaultAvatar',
} as const;

/**
 * 配置键类型
 */
export type ConfigKey = (typeof ConfigKeys)[keyof typeof ConfigKeys];

/**
 * 所有配置模板定义
 * 这是系统配置的单一事实来源 (Single Source of Truth)
 */
export const CONFIG_DEFINITIONS: ConfigDefinition[] = [
  // ==================== 评价配置 ====================
  {
    key: ConfigKeys.REVIEW_AUTO_APPROVE,
    defaultValue: 'false',
    valueType: 'boolean',
    description:
      '是否自动通过评价，开启后用户提交的评价将直接显示，无需管理员审核',
    category: 'review',
  },

  // ==================== 评论配置 ====================
  {
    key: ConfigKeys.COMMENT_AUTO_APPROVE,
    defaultValue: 'false',
    valueType: 'boolean',
    description:
      '是否自动通过评论，开启后用户提交的评论将直接显示，无需管理员审核',
    category: 'comment',
  },

  // ==================== 未来扩展示例 ====================
  // {
  //   key: 'dish.maxImages',
  //   defaultValue: '9',
  //   valueType: 'number',
  //   description: '菜品最多可上传的图片数量',
  //   category: 'dish',
  // },
  // {
  //   key: 'upload.maxFileSize',
  //   defaultValue: '10485760', // 10MB in bytes
  //   valueType: 'number',
  //   description: '单个文件最大上传大小（字节）',
  //   category: 'upload',
  // },
];

/**
 * 根据 key 获取配置定义
 */
export function getConfigDefinition(key: string): ConfigDefinition | undefined {
  return CONFIG_DEFINITIONS.find((def) => def.key === key);
}

/**
 * 获取配置的硬编码默认值
 * 当数据库中没有配置时使用此值作为最终后备
 */
export function getHardcodedDefaultValue(key: string): string | null {
  const definition = getConfigDefinition(key);
  return definition?.defaultValue ?? null;
}

/**
 * 根据 category 获取所有配置定义
 */
export function getConfigDefinitionsByCategory(
  category: string,
): ConfigDefinition[] {
  return CONFIG_DEFINITIONS.filter((def) => def.category === category);
}

/**
 * 获取所有配置类别
 */
export function getAllCategories(): string[] {
  const categories = new Set(CONFIG_DEFINITIONS.map((def) => def.category));
  return Array.from(categories);
}
