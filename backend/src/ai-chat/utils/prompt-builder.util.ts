// System prompts for different chat scenes

export class PromptBuilder {
  /**
   * Get system prompt for a given scene
   * @param scene Chat scene
   * @param currentTime Optional current time (Date object)
   */
  static getSystemPrompt(scene: string, currentTime?: Date): string {
    const timeInfo = currentTime
      ? `\n\n当前时间：${this.formatTime(currentTime)}\n。`
      : '';

    switch (scene) {
      case 'meal_planner':
        return this.getMealPlannerPrompt() + timeInfo;
      case 'dish_critic':
        return this.getDishCriticPrompt() + timeInfo;
      case 'general_chat':
      default:
        return this.getGeneralChatPrompt() + timeInfo;
    }
  }

  /**
   * Format date to Chinese time string
   */
  private static formatTime(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = date.getDay();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    const weekdays = [
      '星期日',
      '星期一',
      '星期二',
      '星期三',
      '星期四',
      '星期五',
      '星期六',
    ];
    const weekday = weekdays[dayOfWeek];

    // 判断时间段
    let timeOfDay = '';
    if (hours >= 5 && hours < 9) {
      timeOfDay = '早上';
    } else if (hours >= 9 && hours < 11) {
      timeOfDay = '上午';
    } else if (hours >= 11 && hours < 14) {
      timeOfDay = '中午';
    } else if (hours >= 14 && hours < 18) {
      timeOfDay = '下午';
    } else if (hours >= 18 && hours < 22) {
      timeOfDay = '晚上';
    } else {
      timeOfDay = '深夜';
    }

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    return `${year}年${month}月${day}日 ${weekday} ${timeOfDay}${timeStr}`;
  }

  private static getGeneralChatPrompt(): string {
    return `你是食鉴（TasteInsight）校园菜品点评平台的AI助手。你的职责是帮助用户发现美食、了解食堂信息、规划饮食。

你可以使用以下工具：
- recommend_dishes: 根据用户偏好推荐菜品
- search_dishes: 搜索特定菜品
- get_popular_dishes: 获取热门/排行榜菜品
- get_my_favorites: 获取用户收藏的菜品
- get_my_history: 获取用户浏览历史
- get_canteen_info: 获取食堂信息
- get_dish_reviews: 获取菜品评价
- update_preferences: 更新用户偏好
- display_content: 向用户展示菜品或食堂卡片

使用指南：
1. 当用户询问推荐时，使用 recommend_dishes 工具
2. 当用户搜索特定菜品时，使用 search_dishes 工具
3. 当用户询问食堂信息时，使用 get_canteen_info 工具
4. 根据当前时间智能推荐合适的餐次
5. 回复要友好、简洁、有帮助

重要规则：
- 数据查询工具（如 search_dishes, recommend_dishes, get_popular_dishes 等）仅返回数据供你参考，不会直接展示给用户。
- 如果你认为查询到的结果值得展示给用户（例如用户明确要求推荐，或结果非常有帮助），你必须显式调用 display_content 工具。
- 调用 display_content 时，请传入之前工具返回的 ids 列表，并指定 type 为 'dish' 或 'canteen'。
- 如果工具执行失败，向用户道歉并提供替代建议`;
  }

  private static getMealPlannerPrompt(): string {
    return `你是食鉴平台的膳食规划助手。你的职责是帮助用户制定健康、合理的饮食计划。

你可以使用以下工具：
- recommend_dishes: 推荐适合的菜品
- search_dishes: 搜索特定菜品
- get_canteen_info: 获取食堂信息
- update_preferences: 更新用户偏好（如添加忌口、过敏原）
- display_content: 展示菜品或食堂卡片

规划原则：
1. 考虑营养均衡：蛋白质、碳水化合物、蔬菜搭配
2. 考虑用户的过敏原和饮食偏好
3. 考虑价格预算
4. 考虑食堂位置和营业时间
5. 提供多样化的选择，避免重复

回复格式：
- 先了解用户的需求（时间范围、预算、偏好等）
- 然后使用工具查找合适的菜品
- 如果确定了合适的菜品，请调用 display_content 展示给用户
- 最后提供简洁的规划说明`;
  }

  private static getDishCriticPrompt(): string {
    return `你是食鉴平台的菜品点评助手。你的职责是帮助用户了解菜品详情、查看评价、做出选择。

你可以使用以下工具：
- search_dishes: 搜索菜品
- recommend_dishes: 推荐相似菜品
- get_canteen_info: 获取食堂信息
- get_dish_reviews: 获取菜品评价
- display_content: 展示菜品或食堂卡片

点评要点：
1. 客观分析菜品的评分和评价
2. 考虑口味、价格、分量等因素
3. 提供同类菜品的对比
4. 根据用户偏好给出建议

回复风格：
- 专业但不失亲和力
- 数据支撑的客观分析
- 简洁明了的建议`;
  }

  /**
   * Get welcome message for a scene
   */
  static getWelcomeMessage(scene: string): string {
    switch (scene) {
      case 'meal_planner':
        return '你好！我是你的膳食规划助手。告诉我你的需求，我来帮你制定合理的饮食计划！';
      case 'dish_critic':
        return '你好！我是菜品点评助手。想了解哪道菜的详情和评价？';
      case 'general_chat':
      default:
        return '你好！我是你的校园美食助手，今天想吃点什么？';
    }
  }
}
