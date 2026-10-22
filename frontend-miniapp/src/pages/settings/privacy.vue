<template>
  <view class="page-content settings-page privacy-page">
    <view v-if="isUserAgreement" class="space-y-6">
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.settings.termsOfService')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.tasteinsightIsOperatedByThe')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section1AccountAndCampusIdentity')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.youMaySignInUsing')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.campusVerificationConfirmsStudentEligibility')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section2PublishingContentAndYour')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.youMaySubmitReviewsRatings')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.youRetainTheRelevantRights')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section3DishAndNutritionInformation')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.dishNamesPricesAvailabilityIngredients')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.nutritionDataAndFoodSuggestions')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section4AiAndPersonalizedServices')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.aiChatRecommendationsAndMeal')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.aiProposedFoodPreferenceChanges')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section5CommunityConductAndReports')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.participateLawfullyAndHonestlyRespect')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.youCanReportContentFrom')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section6ServiceAndResponsibility')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.theOperatingTeamProvidesServices')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.theseTermsAreGovernedBy')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section7UpdatesAndContact')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.updatedTermsAndTheirVersion')
        }}</text>
      </view>
    </view>
    <view v-else class="space-y-6">
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.settings.privacyPolicy')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.theTasteinsightTeamWeExplains')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.readThisPolicyInRelation')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section1SignInAndIdentity')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.phoneSignInOrLinking')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.campusEmailVerificationWeProcess')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.campusEligibilityVerificationAndAccount')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section2ProfileContentAndFood')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.profileWeProcessTheNickname')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.foodPreferencesAndAllergensWe')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.contentAndInteractionWeProcess')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.reportsWeProcessTheReported')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.mealPlansWeProcessDates')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section3AiChatAndPersonalized')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.whenYouUseAiChat')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.conversationsGeneratedAnswersAndPlan')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.personalizedRecommendationsUseFoodPreferences')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section4ExternalServicesAndPublic')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.whenYouUseAFeature')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.aiServicesProcessTheConversations')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.textImagesAndAssociatedProfile')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section5StorageAndProtection')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.profilesAccountAndVerificationRecords')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.personalInformationShouldBeKept')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.weRestrictDataAccessThrough')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section6ManagingYourProfileAnd')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.manageYourNicknamePhotoBio')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.youCanClearLocalData')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section7YourRightsAndHow')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.underApplicableLawYouHave')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.email2366769492QqComWith')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block mt-2">{{
          t('account.legal.theTeamWillVerifyYour')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section8InformationAboutMinors')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.minorsShouldReadThisPolicy')
        }}</text>
      </view>
      <view>
        <text class="font-semibold text-gray-800 mb-3 block text-lg">{{
          t('account.legal.section9UpdatesAndContact')
        }}</text>
        <text class="text-gray-600 text-sm leading-relaxed block">{{
          t('account.legal.updatesAndTheirVersionDate')
        }}</text>
      </view>
    </view>
    <view class="privacy-contact">
      <text class="text-gray-600 text-sm leading-relaxed block">{{
        t('account.legal.contact2366769492QqCom')
      }}</text>
      <button
        class="settings-button privacy-copy"
        hover-class="settings-button--pressed"
        :hover-stay-time="80"
        @click="copyEmailButton.activate"
        @keydown="copyEmailButton.handleKeydown"
        @keyup="copyEmailButton.handleKeyup"
        @blur="copyEmailButton.clearPress"
        role="button"
        tabindex="0"
      >
        {{ t('account.legal.copyContactEmail') }}
      </button>
      <text class="text-gray-500 text-xs block">{{
        t('account.legal.thisVersionTakesEffectOn')
      }}</text>
      <text class="text-gray-500 text-xs block">{{
        t('account.legal.lastUpdatedOctober202026')
      }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { t } from '@/i18n';
import { ref, watchEffect } from 'vue';
import { onHide, onLoad, onShow } from '@dcloudio/uni-app';
import { useButtonActivation } from '@/composables/use-button-activation';

const isUserAgreement = ref(false);
const visible = ref(false);
const copyEmailButton = useButtonActivation(copyPrivacyEmail);
onLoad(options => {
  isUserAgreement.value = options?.type === 'user';
  visible.value = true;
});
onShow(() => {
  visible.value = true;
});
onHide(() => {
  visible.value = false;
});
watchEffect(() => {
  if (!visible.value) return;
  uni.setNavigationBarTitle({
    title: isUserAgreement.value
      ? t('account.settings.termsOfService')
      : t('account.settings.privacyPolicy'),
  });
});

function copyPrivacyEmail() {
  uni.setClipboardData({
    data: '2366769492@qq.com',
    fail: () => uni.showToast({ title: t('account.settings.unableToCopyTryAgain'), icon: 'none' }),
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
.privacy-page .text-lg {
  font-size: 17px;
  line-height: 1.5;
}
.privacy-contact {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e5e7eb;
}
.privacy-page .text-gray-600 {
  color: #475467;
}
.privacy-copy {
  display: inline-flex;
  margin: 12px 0;
}
</style>
