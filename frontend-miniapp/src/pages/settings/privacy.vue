<template>
  <view class="page-content settings-page privacy-page">
    <view>
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
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 您设置的昵称与上传的头像</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 过敏原信息、饮食偏好设置</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 菜品评价内容、评分、图片</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block">• AI聊天对话记录</text>
              <text class="text-gray-600 text-sm leading-relaxed block">• 菜单规划数据</text>
            </view>
          </view>

          <view class="mb-4">
            <text class="font-medium text-gray-700 mb-2 block">1.2 使用过程中产生的信息</text>
            <view class="ml-4 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 客户端运行信息：用于界面适配的屏幕尺寸和平台信息</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 账号信息：登录账号标识与登录状态</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 操作记录：浏览的菜品、收藏及推荐交互记录</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 本地数据：偏好缓存、评价草稿和对话历史</text
              >
            </view>
          </view>

          <view>
            <text class="font-medium text-gray-700 mb-2 block">1.3 信息使用目的</text>
            <view class="ml-4 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 提供核心功能：菜品评价、AI推荐、菜单规划</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 个性化服务：基于您的偏好提供定制化推荐</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 账号管理：维持登录状态、数据同步</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 安全保障：防止滥用、保障平台秩序</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 产品优化：分析使用情况、改进用户体验</text
              >
            </view>
          </view>
        </view>

        <!-- 信息存储与保护 -->
        <view>
          <text class="font-semibold text-gray-800 mb-3 block text-lg">2. 信息存储与保护</text>

          <view class="mb-4">
            <text class="font-medium text-gray-700 mb-2 block">2.1 存储方式</text>
            <view class="ml-4 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 服务器存储：用户资料、评价、饮食规划及对话记录保存于应用服务器与数据库</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 本地存储：当前客户端保存登录状态、偏好缓存和未提交草稿</text
              >
            </view>
          </view>

          <view>
            <text class="font-medium text-gray-700 mb-2 block">2.2 安全措施</text>
            <view class="ml-4 space-y-1">
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 身份校验：需要登录的接口通过访问令牌验证身份</text
              >
              <text class="text-gray-600 text-sm leading-relaxed block"
                >• 访问控制：按用户身份与管理员权限限制相关数据操作</text
              >
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
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 法律法规要求或政府部门要求</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 为保护我们的合法权益或公共安全</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 为提供相关功能，与所使用的服务方共享必要信息</text
            >
          </view>
        </view>

        <!-- 第三方服务 -->
        <view>
          <text class="font-semibold text-gray-800 mb-3 block text-lg">4. 第三方服务</text>

          <view class="mb-4">
            <text class="font-medium text-gray-700 mb-2 block">4.1 微信平台</text>
            <text class="text-gray-600 text-sm leading-relaxed ml-4">
              微信小程序通过微信登录凭证识别账号，不会自动读取您的微信昵称和头像。您可以在个人信息页面自行设置昵称并上传头像。
            </text>
          </view>

          <view>
            <text class="font-medium text-gray-700 mb-2 block">4.2 AI服务</text>
            <text class="text-gray-600 text-sm leading-relaxed ml-4">
              使用 AI 对话时，本次问题、相关历史消息和回答所需的上下文会发送至所配置的 AI
              服务，以生成回答和推荐追问。第三方服务的数据保留和处理规则以该服务方的条款为准。请勿在对话中输入密码等敏感信息。
            </text>
          </view>
        </view>

        <!-- 用户权利 -->
        <view>
          <text class="font-semibold text-gray-800 mb-3 block text-lg">5. 您的权利</text>
          <view class="ml-4 space-y-1">
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 访问权：查看我们收集的您的个人信息</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 更正权：修改不准确或不完整的信息</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 删除权：要求删除您的个人信息</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 撤回同意：撤销对信息处理的同意</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 可携带权：获取您的个人数据副本</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 投诉权：对隐私处理有异议时可投诉</text
            >
          </view>
        </view>

        <!-- Cookie和本地存储 -->
        <view>
          <text class="font-semibold text-gray-800 mb-3 block text-lg">6. 本地存储</text>
          <text class="text-gray-600 text-sm leading-relaxed">
            本小程序使用本地存储来改善用户体验，包括：
          </text>
          <view class="ml-4 mt-2 space-y-1">
            <text class="text-gray-600 text-sm leading-relaxed block">• 登录状态保持</text>
            <text class="text-gray-600 text-sm leading-relaxed block">• 用户偏好设置</text>
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 未提交的评价与设置草稿</text
            >
            <text class="text-gray-600 text-sm leading-relaxed block">• AI 对话历史与界面状态</text>
          </view>
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
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 邮箱：2366769492@qq.com</text
            >
            <button class="settings-button privacy-copy" @click="copyPrivacyEmail">
              复制联系邮箱
            </button>
            <text class="text-gray-600 text-sm leading-relaxed block"
              >• 开发者微信：15535257229</text
            >
          </view>
        </view>

        <!-- 生效日期 -->
        <view class="mt-8 pt-6 border-t border-gray-100">
          <text class="text-gray-500 text-xs text-center block">
            本隐私政策于2025年12月16日生效
          </text>
          <text class="text-gray-500 text-xs text-center block">最后更新时间：2026年10月4日</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
function copyPrivacyEmail() {
  uni.setClipboardData({
    data: '2366769492@qq.com',
    fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' }),
  });
}
</script>

<style scoped>
.privacy-page {
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.privacy-page .text-sm {
  font-size: 16px;
  line-height: 1.75;
}
.privacy-page .text-gray-600 {
  color: #475467;
}
.privacy-copy {
  display: inline-flex;
  margin: 12px 0;
}
</style>
