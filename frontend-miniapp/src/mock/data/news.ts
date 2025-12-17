// Mock 新闻数据
import type { News } from '@/types/api';

export const createMockNews = (): News[] => [
  {
    id: 'news_001',
    title: '一食堂新菜品上线通知',
    content: '<p>亲爱的同学们：</p><p>为了丰富大家的饮食选择，<strong>一食堂</strong>特别推出了一系列新菜品！</p><h3 style="margin-top: 15px; margin-bottom: 10px; color: #ff6b00;">🔥 川味特色小炒</h3><ul><li style="margin-bottom: 5px;"><strong>宫保鸡丁</strong>：选用优质鸡胸肉，搭配香脆花生米，酸甜微辣，开胃下饭。</li><li style="margin-bottom: 5px;"><strong>麻婆豆腐</strong>：麻辣鲜香，豆腐嫩滑，是米饭的最佳拍档。</li></ul><p><img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80" alt="美食图片"></p><h3 style="margin-top: 15px; margin-bottom: 10px; color: #ff6b00;">🍲 养生炖汤系列</h3><p>选用新鲜食材，慢火炖煮，营养丰富。包括：</p><ul><li>玉米排骨汤</li><li>山药乌鸡汤</li></ul><p style="margin-top: 15px;">欢迎大家前来品尝！</p>',
    summary: '一食堂推出川味特色小炒和养生炖汤系列',
    canteenId: 'canteen_001',
    canteenName: '一食堂',
    publishedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin_001',
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'news_002',
    title: '校园食堂卫生检查结果公布（含详细图表）',
    content: `<html><div style="font-family: sans-serif; color: #333;">
  <h1 style="text-align: center; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 10px; font-size: 20px;">校园食堂卫生检查深度报告</h1>
  
  <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 5px solid #42b983;">
    <p style="margin: 0; font-weight: bold;">摘要：</p>
    <p style="margin: 5px 0 0;">本次检查覆盖全校5个食堂，历时7天。检查结果显示整体卫生状况良好，但也发现了一些需要改进的细节。</p>
  </div>

  <h2 style="color: #3498db; margin-top: 20px; font-size: 18px;">1. 检查概况</h2>
  <p>本次检查由<strong>后勤保障部</strong>牵头，联合学生会生活权益部共同进行。检查内容包括：</p>
  <ul style="background-color: #fff; padding-left: 20px;">
    <li style="margin-bottom: 5px;">食材采购与存储规范</li>
    <li style="margin-bottom: 5px;">后厨加工流程卫生</li>
    <li style="margin-bottom: 5px;">餐具清洗与消毒记录</li>
    <li style="margin-bottom: 5px;">从业人员健康证持证情况</li>
  </ul>

  <h2 style="color: #e74c3c; margin-top: 20px; font-size: 18px;">2. 详细评分表</h2>
  <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 14px;">
    <thead>
      <tr style="background-color: #f2f2f2;">
        <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">食堂名称</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">卫生评分</th>
        <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">评级</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">一食堂</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: green; font-weight: bold;">98</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">A+</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">二食堂</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: green;">95</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">A</td>
      </tr>
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">三食堂</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: #f39c12;">92</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">A-</td>
      </tr>
    </tbody>
  </table>

  <h2 style="color: #9b59b6; margin-top: 20px; font-size: 18px;">3. 现场图片展示</h2>
  <p>以下是检查过程中拍摄的后厨实景：</p>
  <div style="text-align: center; margin: 15px 0;">
    <img src="https://images.unsplash.com/photo-1556910103-1c02745a30bf?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80" alt="干净的后厨" style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <p style="font-size: 12px; color: #666; margin-top: 5px;">图1：整洁明亮的后厨操作间</p>
  </div>

  <h2 style="color: #34495e; margin-top: 20px; font-size: 18px;">4. 代码公示</h2>
  <p>为了透明化管理，我们公开了部分卫生评分系统的算法逻辑：</p>
  <pre style="background-color: #282c34; color: #abb2bf; padding: 15px; border-radius: 5px; overflow-x: auto; font-family: monospace; font-size: 12px;">
function calculateScore(cleanliness, safety, service) {
  const weights = {
    cleanliness: 0.5,
    safety: 0.3,
    service: 0.2
  };
  return (cleanliness * weights.cleanliness) + 
         (safety * weights.safety) + 
         (service * weights.service);
}
  </pre>

  <blockquote style="border-left: 4px solid #ccc; margin: 1.5em 10px; padding: 0.5em 10px; color: #666; font-style: italic; background-color: #f9f9f9;">
    "食品安全是底线，也是生命线。我们将持续努力，为师生提供最放心的餐饮服务。" —— 后勤部部长
  </blockquote>

  <div style="margin-top: 30px; text-align: right; font-size: 12px; color: #999;">
    <p>报告生成时间：2025-11-28</p>
    <p>技术支持：TasteInsight 团队</p>
  </div>
  
  <!-- 测试 JS 脚本 (预期不会执行) -->
  <script>
    console.log('This script should not run in uni-app rich-text');
  </script>
</div></html>`,
    summary: '所有食堂达到A级卫生标准，点击查看详细评分表和现场图片',
    canteenId: '',
    canteenName: '',
    publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin_001',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'news_003',
    title: '二食堂推出营养套餐',
    content: '为满足同学们健康饮食需求，二食堂特别推出营养均衡套餐。每份套餐包含主食、荤菜、素菜和汤品，由营养师精心搭配，确保营养均衡。套餐价格实惠，仅需15元。同时提供低脂、低盐、高蛋白等多种选择，满足不同同学的需求。',
    summary: '二食堂推出营养均衡套餐，价格实惠',
    canteenId: 'canteen_002',
    canteenName: '二食堂',
    publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin_002',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'news_004',
    title: '食堂营业时间调整通知',
    content: '根据同学们的需求反馈，从下周起，各食堂将延长晚餐营业时间至21:00。早餐时间调整为6:30-9:00，午餐时间11:00-13:30，晚餐时间17:00-21:00。周末和节假日营业时间保持不变。希望新的营业时间能更好地服务广大师生。',
    summary: '食堂延长晚餐营业时间至21:00',
    canteenId: '',
    canteenName: '',
    publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin_001',
    createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'news_005',
    title: '三食堂特色窗口开放',
    content: '三食堂全新升级的特色窗口今日正式开放！特色窗口主营各地风味小吃，包括陕西肉夹馍、湖南臭豆腐、东北锅包肉等。所有菜品均由经验丰富的师傅现场制作，保证口味正宗。首周推广期间，部分菜品享受8折优惠。欢迎同学们前来品尝！',
    summary: '三食堂特色窗口开放，主营各地风味小吃',
    canteenId: 'canteen_003',
    canteenName: '三食堂',
    publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    createdBy: 'admin_003',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
