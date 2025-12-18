<template>
  <view class="w-full min-h-screen bg-gray-50 p-4">
    <view class="bg-white rounded-xl p-6 shadow-sm">
      <!-- 应用信息 -->
      <view class="text-center mb-8">
        <image src="/static/logo.png" class="w-20 h-20 mx-auto mb-4 rounded-xl" mode="aspectFit" />
        <text class="text-xl font-bold text-gray-800 block">食鉴 TasteInsight</text>
        <text class="text-gray-500 text-sm mt-1">Version 1.0.0</text>
        <text class="text-gray-400 text-xs mt-1">Build 20241216</text>
      </view>

      <!-- 功能介绍 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-school mr-2"></text>关于食鉴
        </text>
        <text class="text-gray-600 text-sm leading-relaxed mb-4">
          食鉴是一款专为高校师生打造的智能食堂评价与推荐小程序。我们致力于通过用户评价、AI推荐和数据分析，为您提供最真实、最有价值的校园餐饮信息。
        </text>

        <view class="bg-blue-50 rounded-lg p-4 mb-4">
          <text class="text-sm font-medium text-blue-800 mb-2 block">
            <text class="iconfont icon-star mr-2"></text>核心功能
          </text>
          <text class="text-blue-700 text-sm leading-relaxed">
            • 智能菜品评价系统：支持文字评价、星级评分、图片上传\n• AI美食推荐：基于您的口味偏好和过敏信息提供个性化推荐\n• 食堂窗口导航：实时查看各窗口菜品和价格信息\n• 菜单规划助手：智能生成每日/每周饮食计划\n• 社区互动：查看他人评价、参与讨论交流\n• 个人中心：收藏菜品、管理评价历史、设置偏好
          </text>
        </view>
      </view>

      <!-- 技术栈 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-flash mr-2"></text>技术栈
        </text>
        <view class="space-y-3">
          <view class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm font-medium text-gray-700">前端框架</text>
            <text class="text-xs text-gray-500">Vue 3 + Composition API</text>
          </view>
          <view class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm font-medium text-gray-700">跨平台框架</text>
            <text class="text-xs text-gray-500">uni-app</text>
          </view>
          <view class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm font-medium text-gray-700">样式框架</text>
            <text class="text-xs text-gray-500">Tailwind CSS</text>
          </view>
          <view class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm font-medium text-gray-700">状态管理</text>
            <text class="text-xs text-gray-500">Pinia</text>
          </view>
          <view class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm font-medium text-gray-700">HTTP客户端</text>
            <text class="text-xs text-gray-500">Axios</text>
          </view>
          <view class="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
            <text class="text-sm font-medium text-gray-700">图标库</text>
            <text class="text-xs text-gray-500">@iconify/json</text>
          </view>
        </view>
      </view>

      <!-- 开发团队 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-team mr-2"></text>开发团队
        </text>
        <view class="space-y-3">
          <view class="flex items-center">
            <view class="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mr-3">
              <text class="text-white font-bold text-sm">T</text>
            </view>
            <view>
              <text class="text-sm font-medium text-gray-700">TasteInsight Team</text>
              <text class="text-xs text-gray-500">独立开发者</text>
            </view>
          </view>
          <text class="text-gray-600 text-sm leading-relaxed">
            由热爱技术的开发者创建，致力于为校园生活提供更好的数字化解决方案。
          </text>
        </view>
      </view>

      <!-- 开源项目 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-link mr-2"></text>开源项目
        </text>
        <view class="space-y-2">
          <view class="flex justify-between items-center py-2 border-b border-gray-100">
            <text class="text-sm text-gray-700">Vue.js</text>
            <text class="text-xs text-gray-500">MIT License</text>
          </view>
          <view class="flex justify-between items-center py-2 border-b border-gray-100">
            <text class="text-sm text-gray-700">uni-app</text>
            <text class="text-xs text-gray-500">Apache-2.0</text>
          </view>
          <view class="flex justify-between items-center py-2 border-b border-gray-100">
            <text class="text-sm text-gray-700">Tailwind CSS</text>
            <text class="text-xs text-gray-500">MIT License</text>
          </view>
          <view class="flex justify-between items-center py-2 border-b border-gray-100">
            <text class="text-sm text-gray-700">Pinia</text>
            <text class="text-xs text-gray-500">MIT License</text>
          </view>
          <view class="flex justify-between items-center py-2">
            <text class="text-sm text-gray-700">其他依赖库</text>
            <text class="text-xs text-gray-500">各种开源协议</text>
          </view>
        </view>
        <text class="text-gray-500 text-xs mt-3">
          感谢所有开源项目的贡献者，为现代Web开发提供了强大的工具链。
        </text>
      </view>

      <!-- 更新日志 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-document mr-2"></text>版本更新
        </text>
        <view class="space-y-3">
          <view class="border-l-4 border-blue-500 pl-4">
            <text class="text-sm font-medium text-gray-700">v1.0.0 (2024-12-16)</text>
            <text class="text-xs text-gray-600 mt-1 block">
              • ✨ 全新发布：完整的食堂评价和AI推荐功能\n• 🎨 现代化UI设计，支持深色模式\n• 🤖 集成AI聊天助手，提供智能美食推荐\n• 📱 优化移动端体验，支持手势操作\n• 🔒 增强隐私保护，合规GDPR要求
            </text>
          </view>
          <view class="border-l-4 border-gray-300 pl-4">
            <text class="text-sm font-medium text-gray-500">未来规划</text>
            <text class="text-xs text-gray-500 mt-1 block">
              • 增加营养分析功能\n• 支持食堂预约点餐\n• 添加好友评价分享\n• 推出小程序PC版本
            </text>
          </view>
        </view>
      </view>

      <!-- 联系我们 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-phone mr-2"></text>联系我们
        </text>
        <view class="space-y-3">
          <view class="flex items-center">
            <view class="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
              <text class="iconfont icon-chat text-green-600"></text>
            </view>
            <view>
              <text class="text-sm text-gray-700">微信公众号</text>
              <text class="text-xs text-gray-500">tasteinsight_official</text>
            </view>
          </view>
          <view class="flex items-center">
            <view class="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <text class="iconfont icon-mail text-blue-600"></text>
            </view>
            <view>
              <text class="text-sm text-gray-700">邮箱反馈</text>
              <text class="text-xs text-gray-500">feedback@tasteinsight.com</text>
            </view>
          </view>
          <view class="flex items-center">
            <view class="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <text class="iconfont icon-feedback text-purple-600"></text>
            </view>
            <view>
              <text class="text-sm text-gray-700">问题反馈</text>
              <text class="text-xs text-gray-500">小程序内设置页提交</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 免责声明 -->
      <view class="mb-8">
        <text class="text-base font-semibold text-gray-800 mb-4 block">
          <text class="iconfont icon-warning mr-2"></text>免责声明
        </text>
        <text class="text-gray-600 text-sm leading-relaxed">
          本小程序提供的菜品评价信息仅供参考，不构成任何形式的消费建议或保证。实际菜品质量可能因季节、厨师等因素有所变化，请以实地考察为准。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed mt-2">
          我们不对因使用本小程序信息而产生的任何直接或间接损失承担责任。如有食物过敏或其他健康问题，请务必咨询专业医生。
        </text>
      </view>

      <!-- 底部版权 -->
      <view class="mt-8 pt-6 border-t border-gray-100 text-center">
        <text class="text-gray-400 text-xs block mb-2">
          Copyright © 2024 TasteInsight. All rights reserved.
        </text>
        <text class="text-gray-400 text-xs">
          基于 Vue.js 和 uni-app 构建 | 遵循 MIT 开源协议
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// About page logic
</script>

