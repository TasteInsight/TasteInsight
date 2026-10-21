<template>
  <view class="page-content settings-page privacy-page">
    <view v-if="isUserAgreement" class="space-y-6">
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">用户协议</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          食鉴（TasteInsight）由 TasteInsight
          食鉴运营团队提供服务。本协议适用于食鉴客户端的账号、菜品信息、内容互动、推荐和饮食规划等服务。请在登录前阅读本协议和《隐私政策》，并自主选择是否同意。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">1. 账号与校园身份</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          您可以选择当前开放的方式登录。请使用本人有权使用的手机号、微信或校园账号，妥善保管验证码和登录凭证。发现账号被他人使用时，可通过本页邮箱联系运营团队。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          校园身份认证用于确认在校资格及相关功能权限。校园邮箱认证、校方授权认证与登录凭证分别管理；将校园账号绑定为登录方式，需要您单独发起并确认。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">2. 内容发布与权利</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          您可以提交评价、评分、评论、帖子、图片及菜品补充信息。请依据实际体验提供准确内容，确认拥有发布所需的权利或授权，尊重他人的隐私、名誉和知识产权。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          您保留所发布内容的相应权利。为展示内容、提供互动和完成审核，您授权食鉴在提供这些服务所需的范围内存储、展示和处理您提交的内容。公开内容及相应昵称、头像可供其他用户查看。饮食计划的公开展示由您在相关设置中选择。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">3. 菜品与营养信息</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          菜品名称、价格、供应情况、配料及营养数据来自平台维护和用户提交，用户提交的补充信息经审核后发布。实际供应与食材以供餐方说明为准，您可以提交更正建议。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          营养数据和饮食建议供日常饮食参考。涉及过敏、疾病、用药或特殊营养需求时，请向供餐方核实食材及交叉接触风险，并向具备资质的专业人员咨询。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">4. AI 与个性化服务</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          AI
          对话、推荐和饮食规划会结合您的请求及相关资料生成结果，可能出现遗漏或错误。请结合菜品实际情况核对，涉及健康的决定应取得专业意见。AI
          涉及的个人信息处理范围见《隐私政策》。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          AI
          提出的饮食偏好修改或计划草稿，由您查看并确认后保存。您可以在相应功能中调整已保存的偏好和计划。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">5. 使用秩序与举报</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          请依法、诚信参与交流，避免发布侵犯他人权益、违法或扰乱服务秩序的内容，避免冒用账号、恶意刷量及干扰系统运行。食鉴可依据内容审核结果和管理规则，对相关内容采取暂缓公开、下架或删除等措施，并依法处理违规行为。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          您可以通过内容页面举报，并在“设置—反馈与举报—我的举报”查看处理进展。对内容处理、账号使用或权利归属有异议时，可向本页邮箱提供相关内容和说明，申请核查。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">6. 服务与责任</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          运营团队依法提供服务并承担相应责任。服务维护、功能调整或外部服务异常可能影响使用；运营团队将结合具体情况处理服务问题。用户与运营团队各自按法律规定及自身过错承担责任。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          本协议适用中华人民共和国法律。争议可先通过本页邮箱协商解决，您也可以依法向有管辖权的人民法院提起诉讼。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">7. 协议更新与联系</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          本协议更新后将在本页公布版本日期；涉及您权益的重要变化，应依法履行告知及取得同意等义务。您可以联系
          TasteInsight 食鉴运营团队，咨询协议、服务或权利保护事项。
        </text>
      </view>
    </view>
    <view v-else class="space-y-6">
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">隐私政策</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          TasteInsight
          食鉴运营团队（以下简称“我们”）通过本政策说明食鉴客户端及相关服务处理个人信息的目的、范围、保存方式和您的权利。联系邮箱：2366769492@qq.com。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          请结合您选择的功能阅读本政策。基于同意的个人信息处理，应以您在充分知情后自愿作出的明确同意为依据；涉及依法需要单独同意的事项，应另行取得您的单独同意。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">1. 登录与身份认证</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          手机号登录或绑定：处理您提交的手机号、验证码及验证结果，用于发送短信、验证号码归属和识别账号。微信登录：通过微信平台校验登录凭证，取得用于识别账号的微信账号标识（OpenID，以及微信返回且用于账号关联的
          UnionID）。昵称和头像由您自行设置。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          校园邮箱认证：处理校园邮箱、验证码、学校及认证状态，用于核验邮箱归属及在校资格。校园授权认证：处理校方返回的账号标识和在校资格信息，并记录认证结果及有效期，用于核验相关资格。用于识别校园身份的标识经摘要处理后保存。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          校园资格认证与账号登录分别管理。您主动绑定校园登录方式时，相关校园账号标识会与当前食鉴账号关联，供后续登录使用。我们还会保存必要的验证时间、有效期、操作状态和网络地址摘要，用于校验请求及防范验证码滥用。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">2. 资料、内容与饮食功能</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          个人资料：处理您设置的昵称、头像、简介，用于展示和管理个人资料。公开评价、帖子、评论等内容会展示相应昵称和头像。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          饮食偏好与过敏原：处理您自愿填写的口味、忌口、价格范围、食堂偏好和过敏原，用于菜品筛选、个性化推荐和饮食规划。过敏原可能反映健康情况，属于需要特别保护的信息，请结合功能需要决定填写范围。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          内容与互动：处理您提交的评价、评分、评论、帖子、图片、菜品和营养补充信息，以及点赞、收藏和菜品浏览记录，用于展示内容、审核、互动、历史查询和推荐。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          举报：处理举报对象、举报类别、原因、处理状态及结果，用于受理和核查举报。举报与您的账号关联，供您查看进展和运营人员处理。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          饮食计划：处理计划日期、餐次、菜品及完成记录，用于创建、调整和查询计划。您开启个人主页的计划展示后，相应计划内容可由其他用户查看。发起约饭时，邀请会展示您的昵称、头像、就餐日期、时间、食堂和人数；申请加入时，发起人可查看您的昵称、头像及申请状态。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">3. AI 对话与个性化推荐</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          使用 AI 对话时，您的本次问题、相关历史消息及为回答问题查询到的资料，会发送给提供回答的 AI
          服务方。按对话需要查询到的资料可能包括已保存的饮食偏好、过敏原、收藏、菜品浏览记录和推荐结果；这些资料会成为回答所用的上下文。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          对话内容、生成的回答和计划或偏好草稿会保存在食鉴服务端；当前客户端也会缓存对话历史。您可以在对话列表删除相关会话。请慎重提供健康情况，妥善保护密码、验证码等账号凭证。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          个性化推荐会使用饮食偏好、过敏原、收藏、评分、浏览和推荐交互记录来匹配菜品。启用推荐计算服务时，会将匹配所需的偏好、过敏原及收藏和浏览特征交由该服务计算。您可以调整相关偏好，也可以通过菜品列表、搜索和筛选自行选择菜品。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">4. 外部服务与公开内容</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          您使用相应功能时，完成该功能所需的信息可能由相关服务方处理：微信平台处理登录凭证和账号标识；短信或邮件服务处理接收号码或邮箱、验证码和发送内容；校园认证服务处理授权请求并返回身份验证结果。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          AI 服务处理第 3
          节列出的对话及上下文。启用在线内容审核时，审核服务处理待审文字、图片或图片访问地址，以及审核所需的账号标识，用于识别违规内容。上传的图片由文件存储服务保存和提供访问。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          您选择公开发布的文字、图片及相应个人资料，会随内容向其他用户展示。依法需要向其他个人信息处理者提供信息、公开个人信息或向境外提供信息的，应履行相应告知、取得单独同意等法定义务。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">5. 存储与保护</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          用户资料、账号及认证记录、内容、举报、计划和 AI
          对话等保存在食鉴服务端的数据库或文件存储中。客户端会保存登录状态、用户资料缓存、设置及评价草稿、对话历史和界面状态，用于保持会话和恢复操作。屏幕尺寸、客户端平台及本地时间等运行信息用于界面适配和相关功能。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          个人信息的保存应限于实现对应处理目的所必要的最短时间：账号及认证信息用于维持账号、核验资格和保障安全；内容、举报、计划及对话记录用于提供对应服务和处理争议。处理目的实现、保存期限届满或出现其他法定删除情形时，应依法删除或匿名化；依法需要继续保存的，限于必要的存储和安全保护。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          我们通过身份校验和权限控制限制相关数据访问。您也应妥善管理设备、账号凭证及本机缓存，发现疑似泄露或异常使用时，请通过本页邮箱联系运营团队。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">6. 管理资料与本机数据</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          您可以在个人页及设置中管理昵称、头像、简介、饮食偏好和过敏原，在相应内容或计划页面管理自己提交的数据，在
          AI 对话列表删除会话。退出登录用于结束当前客户端会话。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          您可以使用客户端所在系统或浏览器的应用数据管理功能清理本机数据；清理可能移除登录状态和未提交草稿。服务器端个人信息的删除申请，请按第
          7 节联系运营团队。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">7. 您的权利与申请方式</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          您依法享有知情、决定、限制或拒绝处理、查阅、复制、更正、补充、删除个人信息及撤回同意等权利。符合规定条件时，您可以申请将个人信息转移至指定的个人信息处理者。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          您可以向 2366769492@qq.com
          发送申请，说明食鉴账号、申请事项、涉及的信息及可用于回复的联系方式。申请可包括查阅或复制资料、更正或删除信息、撤回同意、注销账号，以及要求解释个人信息处理规则。请通过必要信息证明账号归属，妥善保护密码和验证码。
        </text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">
          运营团队将核验申请人与账号的关联，在法律规定的范围内及时处理并向您反馈；涉及依法保留或无法按申请处理的事项，应说明原因。撤回同意后的相关功能可能受影响，撤回前基于同意进行的处理仍依法有效。对处理结果有异议时，您可以申请复核，也可以依法向履行个人信息保护职责的部门投诉或向人民法院起诉。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">8. 未成年人信息</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          未成年人请在监护人指导下阅读本政策并使用服务。处理不满十四周岁未成年人的个人信息，应取得监护人同意并遵守专门保护要求。监护人可以通过本页邮箱提出信息查阅、更正、删除等申请。
        </text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">9. 更新与联系</text>
        <text class="text-gray-600 text-sm leading-relaxed block">
          本政策更新后将在本页公布版本日期。处理目的、方式或信息种类发生变化，以及其他依法需要重新取得同意的情形，应重新履行告知和同意程序。您可以联系
          TasteInsight 食鉴运营团队，咨询个人信息处理规则或提出权利保护申请。
        </text>
      </view>
    </view>
    <view class="mt-8 pt-6 border-t border-gray-100">
      <text class="text-gray-600 text-sm leading-relaxed block">联系邮箱：2366769492@qq.com</text>
      <button
        class="settings-button privacy-copy"
        @click="copyEmailButton.activate"
        @keydown="copyEmailButton.handleKeydown"
        @keyup="copyEmailButton.handleKeyup"
        @blur="copyEmailButton.clearPress"
        role="button"
        tabindex="0"
      >
        复制联系邮箱
      </button>
      <text class="text-gray-500 text-xs block">本版本自公布之日起生效</text>
      <text class="text-gray-500 text-xs block">最后更新时间：2026年10月20日</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { useButtonActivation } from '@/composables/use-button-activation';

const isUserAgreement = ref(false);
const copyEmailButton = useButtonActivation(copyPrivacyEmail);
onLoad(options => {
  isUserAgreement.value = options?.type === 'user';
  uni.setNavigationBarTitle({ title: isUserAgreement.value ? '用户协议' : '隐私政策' });
});

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
