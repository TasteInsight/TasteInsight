<template>
  <view class="w-full min-h-screen bg-gray-50">
    <scroll-view scroll-y class="h-screen">
      <view class="p-6">
        <text class="text-xl font-bold text-gray-800 mb-6 block text-center">用户协议与隐私政策</text>

        <view class="space-y-6">
          <!-- 引言 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">引言</text>
            <text class="text-gray-600 text-sm leading-relaxed">
              食鉴（TasteInsight）小程序（以下简称"本小程序"）由开发者独立运营。本隐私政策将向您说明我们如何收集、使用、存储和保护您的个人信息，以及您享有的相关权利。
            </text>
            <text class="text-gray-600 text-sm leading-relaxed mt-2">
              本政策适用于食鉴小程序的所有功能和服务。如您使用本小程序，即表示您已阅读、理解并同意本政策的全部内容。
            </text>
          </view>

          <!-- 信息收集与使用 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">1. 信息收集与使用</text>

            <view class="mb-4">
              <text class="font-medium text-gray-700 mb-2 block">1.1 您主动提供的信息</text>
              <view class="ml-4 space-y-1">
                <text class="text-gray-600 text-sm leading-relaxed block">• 用户昵称、头像（通过微信授权获取）</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 过敏原信息、饮食偏好设置</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 菜品评价内容、评分、图片</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• AI聊天对话记录</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 菜单规划数据</text>
              </view>
            </view>

            <view class="mb-4">
              <text class="font-medium text-gray-700 mb-2 block">1.2 自动收集的信息</text>
              <view class="ml-4 space-y-1">
                <text class="text-gray-600 text-sm leading-relaxed block">• 设备信息（设备型号、操作系统版本）</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 使用统计信息（访问页面、停留时间）</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 位置信息（用于食堂定位，需授权）</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 缓存数据（本地存储的浏览历史、搜索记录）</text>
              </view>
            </view>

            <view>
              <text class="font-medium text-gray-700 mb-2 block">1.3 信息使用目的</text>
              <view class="ml-4 space-y-1">
                <text class="text-gray-600 text-sm leading-relaxed block">• 提供核心功能：菜品评价、AI推荐、菜单规划</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 个性化服务：基于您的偏好提供定制化推荐</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 账号管理：维持登录状态、数据同步</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 安全保障：防止滥用、保障平台秩序</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 产品优化：分析使用情况、改进用户体验</text>
              </view>
            </view>
          </view>

          <!-- 信息存储与保护 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">2. 信息存储与保护</text>

            <view class="mb-4">
              <text class="font-medium text-gray-700 mb-2 block">2.1 存储方式</text>
              <view class="ml-4 space-y-1">
                <text class="text-gray-600 text-sm leading-relaxed block">• 服务器存储：用户信息、评价数据存储在云服务器</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 本地存储：使用微信小程序本地存储API存储缓存数据</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 加密传输：所有数据传输使用HTTPS加密协议</text>
              </view>
            </view>

            <view>
              <text class="font-medium text-gray-700 mb-2 block">2.2 安全措施</text>
              <view class="ml-4 space-y-1">
                <text class="text-gray-600 text-sm leading-relaxed block">• 数据加密：敏感信息采用AES加密存储</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 访问控制：严格的权限管理机制</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 定期审计：安全漏洞扫描和修复</text>
                <text class="text-gray-600 text-sm leading-relaxed block">• 备份恢复：数据定期备份，保障数据安全</text>
              </view>
            </view>
          </view>

          <!-- 信息共享与披露 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">3. 信息共享与披露</text>
            <text class="text-gray-600 text-sm leading-relaxed">
              我们承诺不会向第三方出售、出租或以其他方式披露您的个人信息，除非：
            </text>
            <view class="ml-4 mt-2 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block">• 获得您的明确同意</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 法律法规要求或政府部门要求</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 为保护我们的合法权益或公共安全</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 与可信赖的合作伙伴共享（已签署保密协议）</text>
            </view>
          </view>

          <!-- 第三方服务 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">4. 第三方服务</text>

            <view class="mb-4">
              <text class="font-medium text-gray-700 mb-2 block">4.1 微信平台</text>
              <text class="text-gray-600 text-sm leading-relaxed ml-4">
                本小程序使用微信登录服务，获取您的微信昵称、头像等公开信息。微信平台的隐私政策请参考微信官方政策。
              </text>
            </view>

            <view>
              <text class="font-medium text-gray-700 mb-2 block">4.2 AI服务</text>
              <text class="text-gray-600 text-sm leading-relaxed ml-4">
                AI聊天和推荐功能可能使用第三方AI服务。您的对话数据仅用于生成回复，不会用于训练模型或提供给第三方。
              </text>
            </view>
          </view>

          <!-- 用户权利 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">5. 您的权利</text>
            <view class="ml-4 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block">• 访问权：查看我们收集的您的个人信息</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 更正权：修改不准确或不完整的信息</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 删除权：要求删除您的个人信息</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 撤回同意：撤销对信息处理的同意</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 数据 portability：获取您的个人数据副本</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 投诉权：对隐私处理有异议时可投诉</text>
            </view>
          </view>

          <!-- Cookie和本地存储 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">6. Cookie和本地存储</text>
            <text class="text-gray-600 text-sm leading-relaxed">
              本小程序使用本地存储来改善用户体验，包括：
            </text>
            <view class="ml-4 mt-2 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block">• 登录状态保持</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 用户偏好设置</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 搜索历史记录</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 缓存数据（菜品信息、评价数据）</text>
            </view>
            <text class="text-gray-600 text-sm leading-relaxed mt-2">
              您可以通过小程序设置清除本地存储数据。
            </text>
          </view>

          
          <!-- 政策更新 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">7. 政策更新</text>
            <text class="text-gray-600 text-sm leading-relaxed">
              我们可能会不定期更新本隐私政策。重大变更时，我们会通过小程序内通知等方式告知您。请定期查看本政策。
            </text>
          </view>

          <!-- 联系我们 -->
          <view>
            <text class="font-semibold text-gray-800 mb-3 block text-lg">8. 联系我们</text>
            <text class="text-gray-600 text-sm leading-relaxed">
              如果您对本隐私政策有任何疑问、意见或需要行使相关权利，请通过以下方式联系我们：
            </text>
            <view class="ml-4 mt-2 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block">• 邮箱：privacy@tasteinsight.com</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 小程序内反馈功能</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 开发者微信：tasteinsight_dev</text>
            </view>
          </view>

          <!-- 生效日期 -->
          <view class="mt-8 pt-6 border-t border-gray-100">
            <text class="text-gray-500 text-xs text-center block">
              本隐私政策于2024年12月16日生效\n最后更新时间：2024年12月16日
            </text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
// Privacy page logic
</script>

