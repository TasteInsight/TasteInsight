<template>
  <div class="admin-page">
    <div class="admin-panel">
      <!-- 列表视图 -->
      <div v-if="viewMode === 'list'">
        <div class="admin-heading-row">
          <Header
            title="人员权限管理"
            description="管理子管理员账号和权限分配"
            header-icon="clarity:group-line"
          />
          <button
            class="text-white transition duration-200 flex items-center admin-button"
            :class="authStore.hasPermission('admin:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('admin:create') ? null : createNewAdmin()"
            :title="!authStore.hasPermission('admin:create') ? '无权限创建' : '创建子管理员'"
          >
            <AppIcon class="iconify mr-1" icon="carbon:add"></AppIcon>
            创建子管理员
          </button>
        </div>

        <!-- 搜索和筛选栏 -->
        <div class="mb-6 space-y-4">
          <!-- 搜索栏 -->
          <div class="relative">
            <AppIcon class="iconify absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" icon="carbon:search"></AppIcon>
            <input
              type="text"
              v-model="searchQuery"
              placeholder="搜索用户名、角色名称..."
              class="w-full pl-10 pr-10 admin-input"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 admin-icon-button"
              @click="searchQuery = ''"
              type="button"
              title="清除搜索"
            >
              <AppIcon class="iconify" icon="carbon:close"></AppIcon>
            </button>
          </div>
          
          <!-- 筛选栏 -->
        <div class="admin-toolbar">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">管理范围</span>
              <div class="relative">
                <select
                  v-model="canteenFilter"
                  @change="handleFilterChange"
                  class="bg-white min-w-[200px] transition-all cursor-pointer hover:border-gray-400 admin-input"
                >
                  <option value="">不限管理范围</option>
                  <option value="all">全局范围</option>
                  <option v-for="canteen in canteenList" :key="canteen.id" :value="canteen.id">
                    {{ canteen.name }}
                  </option>
                </select>
              </div>
            </div>

            <div class="ml-auto flex items-center">
              <button
                v-if="canteenFilter || searchQuery"
                @click="resetFilters"
                class="text-gray-500 hover:text-tsinghua-purple flex items-center gap-1.5 hover:bg-gray-200/50 transition-colors admin-button"
              >
                <AppIcon class="iconify" icon="carbon:reset"></AppIcon>
                重置筛选
              </button>
            </div>
          </div>
        </div>

        <!-- 管理员列表表格 -->
        <div class="admin-table-scroll">
        <table class="admin-table">
            <thead class="bg-gray-50">
              <tr>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">用户名</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">角色名称</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">管理范围</th>
                <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">创建时间</th>
                <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="admin in filteredAdmins" :key="admin.id" class="hover:bg-gray-50">
                <td class="py-4 px-6">
                  <div class="font-medium">{{ admin.username }}</div>
                  <div v-if="admin.deletedAt" class="text-xs text-amber-700 mt-1">已停用 · 下属待移交</div>
                  <div v-if="admin.directReportCount" class="text-xs text-gray-500 mt-1">直属下属 {{ admin.directReportCount }} 人</div>
                </td>
                <td class="py-4 px-6">
                  <span
                    class="px-2 py-1 text-xs rounded-full bg-tsinghua-purple/10 text-tsinghua-purple"
                  >
                    {{ getRoleLabel(admin.role) }}
                  </span>
                  <p class="mt-2 text-xs text-gray-500">{{ admin.role === 'superadmin' ? '系统全部权限' : `${admin.permissions?.length || 0} 项权限` }}</p>
                </td>
                <td class="py-4 px-6 text-sm">{{ formatAdminScope(admin) }}</td>
                <td class="py-4 px-6 text-sm text-gray-500">{{ formatDate(admin.createdAt) }}</td>
                <td class="py-4 px-6 text-center" @click.stop>
                  <div class="flex items-center justify-center gap-2">
                    <button
                      v-if="admin.directReportCount && authStore.hasPermission('admin:edit')"
                      class="text-tsinghua-purple hover:bg-purple-50 admin-button"
                      @click.stop="openHandover(admin)"
                    ><AppIcon class="iconify" icon="carbon:user-follow"></AppIcon>移交下属</button>
                    <button
                      v-if="!admin.deletedAt"
                      class="rounded-full hover:bg-gray-200 admin-icon-button"
                      :class="authStore.hasPermission('admin:edit') ? 'text-tsinghua-purple' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('admin:edit') ? null : editAdmin(admin)"
                      :title="!authStore.hasPermission('admin:edit') ? '无权限编辑' : '编辑权限'"
                    >
                      <AppIcon class="iconify" icon="carbon:edit"></AppIcon>
                    </button>
                    <button
                      v-if="!admin.deletedAt"
                      class="rounded-full hover:bg-gray-200 admin-icon-button"
                      :class="authStore.hasPermission('admin:edit') ? 'text-orange-500' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('admin:edit') ? null : openResetPasswordModal(admin)"
                      :title="!authStore.hasPermission('admin:edit') ? '无权限修改密码' : '重置密码'"
                    >
                      <AppIcon class="iconify" icon="carbon:password"></AppIcon>
                    </button>
                    <button
                      v-if="!admin.deletedAt"
                      class="rounded-full hover:bg-gray-200 admin-icon-button"
                      :class="authStore.hasPermission('admin:delete') ? 'text-red-500' : 'text-gray-400 cursor-not-allowed'"
                      @click.stop="!authStore.hasPermission('admin:delete') ? null : deleteAdmin(admin)"
                      :title="!authStore.hasPermission('admin:delete') ? '缺少停用权限' : '停用管理员'"
                    >
                      <AppIcon class="iconify" icon="carbon:trash-can"></AppIcon>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredAdmins.length === 0 && !loading" class="admin-state">
          <AppIcon
            class="iconify text-6xl text-gray-300 mx-auto"
            icon="clarity:group-line"
          ></AppIcon>
          <p class="mt-4 text-gray-500">暂无子管理员</p>
          <button
            class="mt-4 text-white transition duration-200 admin-button"
            :class="authStore.hasPermission('admin:create') ? 'bg-tsinghua-purple hover:bg-tsinghua-dark' : 'bg-gray-400 cursor-not-allowed'"
            @click="!authStore.hasPermission('admin:create') ? null : createNewAdmin()"
            :title="!authStore.hasPermission('admin:create') ? '无权限创建' : '创建第一个子管理员'"
          >
            创建第一个子管理员
          </button>
        </div>

        <Pagination
          v-if="totalPages > 1"
          class="mt-6"
          :current-page="currentPage"
          :page-size="pageSize"
          :total="total"
          @page-change="changePage"
        />
      </div>

      <!-- 创建/编辑视图 -->
      <div v-else>
        <div class="admin-heading-row">
          <Header
            :title="editingAdmin ? '编辑子管理员' : '创建子管理员'"
            :description="
              editingAdmin ? '修改子管理员信息和权限' : '创建新的子管理员账号并分配权限'
            "
            header-icon="clarity:group-line"
          />
          <button
            class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
            @click="backToList"
          >
            返回列表
          </button>
        </div>

        <form class="space-y-6">
        <div class="admin-form-grid">
            <!-- 左侧列 -->
            <div>
              <!-- 用户名 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2 admin-label">
                  用户名 <span class="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  v-model="formData.username"
                  @input="errors.username = ''"
                  class="w-full admin-input"
                  :class="{
                    'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.username,
                  }"
                  placeholder="例如：admin001"
                  :disabled="!!editingAdmin"
                  required
                />
                <p v-if="errors.username" class="mt-1 text-xs text-red-500 flex items-center admin-field-error">
                  <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                  {{ errors.username }}
                </p>
                <p v-else-if="editingAdmin" class="mt-1 text-sm text-gray-500">用户名创建后不可修改</p>
              </div>

              <!-- 密码 -->
              <div v-if="!editingAdmin" class="mb-6">
                <label class="block text-gray-700 font-medium mb-2 admin-label">
                  初始密码 <span class="text-red-500">*</span>
                </label>
                <div class="flex gap-2">
                  <input
                    v-model="formData.password"
                    @input="errors.password = ''"
                    type="text"
                    class="flex-1 admin-input"
                    :class="{
                      'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.password,
                    }"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    @click="generatePassword"
                    class="border border-gray-300 hover:bg-gray-50 transition admin-button"
                  >
                    随机生成
                  </button>
                </div>
                <div class="h-1 bg-gray-200 rounded mt-2 overflow-hidden">
                  <div
                    class="h-full transition-all"
                    :class="passwordStrengthClass"
                    :style="{ width: passwordStrengthWidth }"
                  ></div>
                </div>
                <div class="text-xs text-gray-500 mt-1">{{ passwordStrengthText }}</div>
                <p v-if="errors.password" class="mt-1 text-xs text-red-500 flex items-center admin-field-error">
                  <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                  {{ errors.password }}
                </p>
              </div>

              <!-- 角色 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2 admin-label">
                  角色名称
                </label>
                <p class="mb-3 text-sm text-gray-500">预设用于填充权限，实际授权以勾选项和管理范围为准。</p>
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="role in roles"
                    :key="role.value"
                    @click="selectRole(role.value)"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="
                      formData.role === role.value
                        ? 'border-tsinghua-purple bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    "
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        :value="role.value"
                        v-model="formData.role"
                        class="text-tsinghua-purple"
                      />
                      <div>
                        <div class="font-medium text-sm">{{ role.label }}</div>
                        <div class="text-xs text-gray-500">{{ role.desc }}</div>
                      </div>
                    </div>
                  </div>
                  <!-- 自定义角色选项 -->
                  <div
                    @click="selectRole('custom')"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="
                      formData.role === 'custom'
                        ? 'border-tsinghua-purple bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    "
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        value="custom"
                        v-model="formData.role"
                        class="text-tsinghua-purple"
                      />
                      <div>
                        <div class="font-medium text-sm">自定义角色</div>
                        <div class="text-xs text-gray-500">输入自定义角色名称</div>
                      </div>
                    </div>
                  </div>
                  <!-- 普通管理员选项 -->
                  <div
                    @click="selectRole('')"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="
                      !formData.role
                        ? 'border-tsinghua-purple bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    "
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        :value="''"
                        v-model="formData.role"
                        class="text-tsinghua-purple"
                      />
                      <div>
                        <div class="font-medium text-sm">普通管理员</div>
                        <div class="text-xs text-gray-500">使用默认名称，手动配置权限</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- 自定义角色输入框 -->
                <div v-if="formData.role === 'custom'" class="mt-3">
                  <label class="block text-gray-600 mb-1 admin-label">
                    自定义角色名称
                  </label>
                  <input
                    type="text"
                    v-model="formData.customRole"
                    @input="errors.customRole = ''"
                    class="w-full admin-input"
                    :class="{
                      'border-red-400 bg-red-50 focus:ring-red-400 focus:border-red-400': errors.customRole,
                    }"
                    placeholder="请输入自定义角色名称，例如：数据分析师、运营专员等"
                    maxlength="50"
                  />
                  <p v-if="errors.customRole" class="mt-1 text-xs text-red-500 flex items-center admin-field-error">
                    <AppIcon class="iconify mr-1 text-xs" icon="carbon:warning"></AppIcon>
                    {{ errors.customRole }}
                  </p>
                  <p v-else class="mt-1 text-xs text-gray-500">
                    自定义角色不会自动分配权限，请手动选择所需权限
                  </p>
                </div>
              </div>

              <!-- 管理范围 -->
              <div class="mb-6">
                <label class="block text-gray-700 font-medium mb-2 admin-label">管理范围（食堂）</label>
                <select v-model="formData.scope" class="w-full bg-white admin-input">
                  <option v-if="authStore.user?.scope === 'GLOBAL'" value="GLOBAL">全局范围</option>
                  <option value="CANTEENS">指定食堂</option>
                </select>
                <fieldset v-if="formData.scope === 'CANTEENS'" class="mt-3 space-y-2 rounded-lg border border-gray-200 p-3 max-h-48 overflow-auto">
                  <legend class="px-1 text-sm text-gray-600">授权食堂（可多选）</legend>
                  <label v-for="canteen in canteenList" :key="canteen.id" class="flex items-center gap-2 text-sm text-gray-700">
                    <input v-model="formData.canteenIds" type="checkbox" :value="canteen.id" class="accent-tsinghua-purple" />
                    {{ canteen.name }}
                  </label>
                  <p v-if="!canteenList.length" class="text-sm text-gray-500">暂无可授权食堂</p>
                </fieldset>
                <p v-if="errors.scope" class="mt-1 text-sm text-red-500 admin-field-error">{{ errors.scope }}</p>
                <p class="mt-2 text-sm text-gray-500">
                  操作权限单独分配。指定食堂范围至少选择一个食堂；学生身份审核、社区管理和推荐实验仅限全局范围。
                </p>
                <p v-if="editingAdmin" class="mt-1 text-sm text-gray-500">缩小范围会同步收窄其下级账号的食堂范围。</p>
              </div>
            </div>

            <!-- 右侧列 -->
            <div>
              <!-- 权限配置 -->
              <div class="mb-6">
                <div class="admin-permission-heading">
                  <h3 class="font-medium text-gray-700">权限配置</h3>
                  <div class="admin-permission-selection" data-permission-selection="all">
                    <label class="admin-permission-select">
                      <input type="checkbox" aria-label="全选可分配权限" aria-describedby="permission-selection-count"
                        :checked="isAllPermissionsSelected" :indeterminate="isSomePermissionsSelected"
                        :disabled="assignablePermissionIds.length === 0" @change="toggleAllPermissions" />
                      <span>全选可分配权限</span>
                    </label>
                    <span id="permission-selection-count" class="admin-permission-count" aria-live="polite">已选 {{ selectedPermissionCount }} / {{ assignablePermissionIds.length }} 项</span>
                  </div>
                </div>

                <div class="space-y-4 max-h-[500px] overflow-y-auto border rounded-lg p-4">
                  <div v-for="permissionGroup in permissionGroups" :key="permissionGroup.id"
                    role="group" :aria-label="permissionGroup.name">
                    <div class="admin-permission-group-heading">
                      <label class="admin-permission-select">
                        <input type="checkbox" :aria-label="`全选${permissionGroup.name}权限`"
                          :aria-describedby="`permission-count-${permissionGroup.id}`"
                          :checked="isGroupSelected(permissionGroup)" :indeterminate="isGroupPartiallySelected(permissionGroup)"
                          @change="toggleGroupPermissions(permissionGroup)" />
                        <span class="font-medium">{{ permissionGroup.name }}</span>
                      </label>
                      <span :id="`permission-count-${permissionGroup.id}`" class="admin-permission-count">{{ selectedGroupPermissionCount(permissionGroup) }} / {{ permissionGroup.permissions.length }}</span>
                    </div>

                    <div class="grid grid-cols-1 gap-2 ml-3">
                      <div
                        v-for="permission in permissionGroup.permissions"
                        :key="permission.id"
                        class="flex items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          :id="permission.id"
                          :checked="isPermissionChecked(permission.id)"
                          @change="togglePermission(permission.id)"
                          class="admin-permission-checkbox"
                        />
                        <label :for="permission.id" class="text-gray-700 cursor-pointer admin-label">
                          {{ permission.label }}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
                <p v-if="errors.permissions" class="mt-2 text-sm text-red-600 admin-field-error" role="alert">{{ errors.permissions }}</p>
              </div>
            </div>
          </div>

          <!-- 表单按钮 -->
          <div class="flex pt-6 border-t border-gray-200 admin-actions">
            <button
              type="button"
              class="transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed admin-button admin-button-primary"
              @click="submitForm"
              :disabled="isSubmitting"
            >
              <AppIcon class="iconify mr-1" icon="carbon:save"></AppIcon>
              {{ isSubmitting ? '提交中...' : editingAdmin ? '保存修改' : '创建子管理员' }}
            </button>
            <button
              type="button"
              class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-200 admin-button"
              @click="backToList"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>

    <AdminDialog v-if="handoverTarget" :open="!!handoverTarget" label="移交下属" @close="closeHandover">
      <div class="w-full max-w-md mx-4 admin-dialog-panel" @click.stop>
        <div class="admin-dialog-header">
          <h3 class="text-lg font-semibold text-gray-800">移交 {{ handoverTarget.username }} 的下属</h3>
          <button type="button" class="admin-icon-button text-gray-500 hover:text-gray-700" aria-label="关闭移交下属" :disabled="handoverSubmitting" @click="closeHandover">
            <AppIcon class="iconify text-xl" icon="carbon:close"></AppIcon>
          </button>
        </div>
        <form class="space-y-4 admin-dialog-body" @submit.prevent="submitHandover">
          <p class="text-sm text-gray-600">直属下属连同各自的管理层级一起移交，现有账号、权限和创建记录保留。新负责人的权限及食堂范围须覆盖待移交账号。</p>
          <div>
            <label for="handover-manager" class="block mb-2 admin-label">新负责人</label>
            <select id="handover-manager" v-model="handoverManagerId" class="w-full admin-input" :disabled="handoverLoading || handoverSubmitting" required @change="handoverError = ''">
              <option value="">{{ handoverLoading ? '加载负责人...' : '请选择新负责人' }}</option>
              <option v-for="candidate in handoverCandidates" :key="candidate.id" :value="candidate.id">{{ candidate.username }} · {{ formatAdminScope(candidate) }}</option>
            </select>
          </div>
          <label v-if="!handoverTarget.deletedAt && authStore.hasPermission('admin:delete')" class="flex items-center gap-2 text-sm text-gray-700">
            <input v-model="handoverRetireSource" type="checkbox" :disabled="handoverSubmitting" class="accent-tsinghua-purple" />
            移交完成后停用原负责人账号
          </label>
          <p v-if="handoverError" class="admin-field-error" role="alert">{{ handoverError }}</p>
          <div class="flex justify-end gap-3 admin-actions">
            <button type="button" class="admin-button border border-gray-300" :disabled="handoverSubmitting" @click="closeHandover">取消</button>
            <button type="submit" class="admin-button admin-button-primary" :disabled="handoverLoading || handoverSubmitting || !handoverManagerId">{{ handoverSubmitting ? '移交中...' : handoverRetireSource ? '确认移交并停用' : '确认移交' }}</button>
          </div>
        </form>
      </div>
    </AdminDialog>

    <!-- 重置子管理员密码的弹窗 -->
    <AdminDialog
      v-if="showResetPasswordModal"
      :open="showResetPasswordModal"
      label="重置密码"
      @close="closeResetPasswordModal"
    >
      <div class="relative w-full max-w-md mx-4 admin-dialog-panel" @click.stop>
        <div class="admin-dialog-header">
          <h3 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <AppIcon class="iconify text-orange-500" icon="carbon:password"></AppIcon>
            重置密码 - {{ resetPasswordTarget?.username }}
          </h3>
        </div>
        <form @submit.prevent="handleResetPassword" class="space-y-4 admin-dialog-body">
          <div>
            <label class="block text-gray-700 font-medium mb-2 admin-label">
              新密码 <span class="text-red-500">*</span>
            </label>
            <div class="flex gap-2">
              <input
                type="text"
                :value="resetPasswordForm.newPassword"
                @input="handleResetPasswordInput('newPassword', $event)"
                class="flex-1 focus:outline-none admin-input"
                :class="{ 'border-red-400 bg-red-50': resetPasswordError }"
                placeholder="请输入新密码"
                autocomplete="new-password"
              />
              <button
                type="button"
                @click="generateResetPassword"
                class="border border-gray-300 hover:bg-gray-50 transition whitespace-nowrap admin-button"
              >
                随机生成
              </button>
            </div>
          </div>
          <div>
            <label class="block text-gray-700 font-medium mb-2 admin-label">
              确认新密码 <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              :value="resetPasswordForm.confirmPassword"
              @input="handleResetPasswordInput('confirmPassword', $event)"
              class="w-full focus:outline-none admin-input"
              :class="{ 'border-red-400 bg-red-50': resetPasswordError }"
              placeholder="请再次输入新密码"
              autocomplete="new-password"
            />
          </div>
          <!-- 密码要求动态检查 -->
          <div class="text-xs bg-gray-50 rounded-lg p-3">
            <p class="font-medium text-gray-600 mb-2">密码要求：</p>
            <ul class="space-y-1">
              <li class="flex items-center gap-2" :class="resetPasswordChecks.length ? 'text-green-700' : 'text-gray-500'">
                <AppIcon class="iconify text-sm" :icon="resetPasswordChecks.length ? 'carbon:checkmark-filled' : 'carbon:close'"></AppIcon>
                至少 8 个字符
              </li>
              <li class="flex items-center gap-2" :class="resetPasswordChecks.uppercase ? 'text-green-700' : 'text-gray-500'">
                <AppIcon class="iconify text-sm" :icon="resetPasswordChecks.uppercase ? 'carbon:checkmark-filled' : 'carbon:close'"></AppIcon>
                包含大写字母（A-Z）
              </li>
              <li class="flex items-center gap-2" :class="resetPasswordChecks.lowercase ? 'text-green-700' : 'text-gray-500'">
                <AppIcon class="iconify text-sm" :icon="resetPasswordChecks.lowercase ? 'carbon:checkmark-filled' : 'carbon:close'"></AppIcon>
                包含小写字母（a-z）
              </li>
              <li class="flex items-center gap-2" :class="resetPasswordChecks.number ? 'text-green-700' : 'text-gray-500'">
                <AppIcon class="iconify text-sm" :icon="resetPasswordChecks.number ? 'carbon:checkmark-filled' : 'carbon:close'"></AppIcon>
                包含数字（0-9）
              </li>
              <li class="flex items-center gap-2" :class="resetPasswordChecks.special ? 'text-green-700' : 'text-gray-500'">
                <AppIcon class="iconify text-sm" :icon="resetPasswordChecks.special ? 'carbon:checkmark-filled' : 'carbon:close'"></AppIcon>
                包含特殊符号（如 !@#$%^&amp;*）
              </li>
            </ul>
          </div>
          <p v-if="resetPasswordError" class="text-sm text-red-500 flex items-center gap-1 admin-field-error">
            <AppIcon class="iconify" icon="carbon:warning"></AppIcon>
            {{ resetPasswordError }}
          </p>
          <p class="text-sm text-gray-500">
            <AppIcon class="iconify inline-block" icon="carbon:information"></AppIcon>
            密码重置后，请将新密码告知该管理员。建议让管理员登录后立即修改密码。
          </p>
          <div class="flex justify-end gap-3 pt-4 admin-actions">
            <button
              type="button"
              @click="closeResetPasswordModal"
              class="border border-gray-300 text-gray-700 hover:bg-gray-100 transition admin-button"
            >
              取消
            </button>
            <button
              type="submit"
              :disabled="isResettingPassword"
              class="bg-orange-700 text-white hover:bg-orange-800 transition disabled:opacity-50 disabled:cursor-not-allowed admin-button"
            >
              {{ isResettingPassword ? '重置中...' : '确认重置' }}
            </button>
          </div>
        </form>
      </div>
    </AdminDialog>
  </div>
</template>

<script>
import { formatAdminScope } from '@/utils/admin-scope'
import { reactive, ref, computed, watch, onMounted, onActivated } from 'vue'
import { permissionApi } from '@/api/modules/permission'
import { canteenApi } from '@/api/modules/canteen'
import { generateAdminPassword } from '@/utils/admin-password'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Header from '@/components/Layout/Header.vue'
import AdminDialog from '@/components/Common/AdminDialog.vue'
import Pagination from '@/components/Common/Pagination.vue'
import { savePageState, restorePageState } from '@/utils/page-state-cache'
import { showConfirmDanger } from '@/composables/useModal'
import { useNotification } from '@/composables/useNotification'

const PAGE_STATE_KEY = 'user-manage'

export default {
  name: 'UserManage',
  components: {
    Header,
    AdminDialog,
    Pagination,
  },
  setup() {
    const notify = useNotification()
    const authStore = useAuthStore()
    const isSubmitting = ref(false)
    const loading = ref(false)
    const viewMode = ref('list') // 'list' 或 'edit'
    const editingAdmin = ref(null) // 当前编辑的管理员
    const adminList = ref([]) // 子管理员列表
    const canteenList = ref([]) // 食堂列表
    const handoverTarget = ref(null)
    const handoverManagerId = ref('')
    const handoverRetireSource = ref(false)
    const handoverCandidates = ref([])
    const handoverLoading = ref(false)
    const handoverSubmitting = ref(false)
    const handoverError = ref('')
    
    // 重置子管理员密码相关状态
    const showResetPasswordModal = ref(false)
    const isResettingPassword = ref(false)
    const resetPasswordError = ref('')
    const resetPasswordTarget = ref(null)
    const resetPasswordForm = reactive({
      newPassword: '',
      confirmPassword: '',
    })

    // 重置密码强度动态检查
    const resetPasswordChecks = computed(() => ({
      length: resetPasswordForm.newPassword.length >= 8,
      uppercase: /[A-Z]/.test(resetPasswordForm.newPassword),
      lowercase: /[a-z]/.test(resetPasswordForm.newPassword),
      number: /\d/.test(resetPasswordForm.newPassword),
      special: /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(resetPasswordForm.newPassword),
    }))

    // 处理重置密码输入，同时清除错误状态
    const handleResetPasswordInput = (field, event) => {
      resetPasswordForm[field] = event.target.value
      if (resetPasswordError.value) {
        resetPasswordError.value = ''
      }
    }
    
    // 默认状态定义
    const defaultState = {
      searchQuery: '',
      canteenFilter: '',
      currentPage: 1,
    }
    
    // 从缓存恢复状态
    const restoredState = restorePageState(PAGE_STATE_KEY, defaultState)
    const searchQuery = ref(restoredState.searchQuery)
    const canteenFilter = ref(restoredState.canteenFilter) // 食堂筛选
    const currentPage = ref(restoredState.currentPage)
    const pageSize = ref(10)
    const totalPages = ref(1)
    const total = ref(0)
    
    // 保存页面状态
    const saveState = () => {
      savePageState(PAGE_STATE_KEY, {
        searchQuery: searchQuery.value,
        canteenFilter: canteenFilter.value,
        currentPage: currentPage.value,
      })
    }

    // 表单错误状态
    const errors = reactive({
      username: '',
      password: '',
      permissions: '',
      customRole: '',
      scope: '',
    })

    const formData = reactive({
      username: '',
      password: '',
      role: '',
      customRole: '',
      scope: authStore.user?.scope || 'CANTEENS',
      canteenIds: [...(authStore.user?.canteenIds || [])],
      permissions: [],
    })

    const roles = [
      { value: 'full_access', label: '全部可分配权限', desc: '按当前管理范围分配权限' },
      { value: 'canteen_manager', label: '食堂主管', desc: '管理多个食堂' },
      { value: 'restaurant_manager', label: '餐厅经理', desc: '单个食堂管理' },
      { value: 'kitchen_operator', label: '后厨操作员', desc: '菜品与库存管理' },
      { value: 'news_editor', label: '新闻编辑', desc: '发布和管理新闻' },
      { value: 'auditor', label: '内容审核员', desc: '审核评价、评论和处理举报' },
    ]

    const allPermissionGroups = computed(() => authStore.authorization.groups)
    const permissionGroups = computed(() => allPermissionGroups.value
      .map(group => ({ ...group, permissions: group.permissions.filter(permission =>
        authStore.permissions.includes(permission.id) &&
        (formData.scope === 'GLOBAL' || !authStore.authorization.globalOnly.includes(permission.id)),
      ) }))
      .filter(group => group.permissions.length > 0))

    watch(() => formData.scope, scope => {
      if (scope === 'CANTEENS') formData.permissions = formData.permissions.filter(permission => !authStore.authorization.globalOnly.includes(permission))
    })

    const getPermissionClosure = (permissionIds) => {
      const resolved = new Set()
      const visit = (permissionId) => {
        if (resolved.has(permissionId)) return
        resolved.add(permissionId)
        ;(authStore.authorization.dependencies[permissionId] || []).forEach(visit)
      }

      permissionIds.forEach(visit)
      return [...resolved]
    }

    // 过滤后的管理员列表
    const filteredAdmins = computed(() => {
      let filtered = adminList.value

      // 搜索筛选
      if (searchQuery.value) {
        const query = searchQuery.value.toLowerCase()
        filtered = filtered.filter(
          (admin) =>
            admin.username.toLowerCase().includes(query) ||
            getRoleLabel(admin.role).toLowerCase().includes(query),
        )
      }

      // 食堂筛选
      if (canteenFilter.value) {
        if (canteenFilter.value === 'all') {
          // 筛选全局范围账号
          filtered = filtered.filter((admin) => admin.scope === 'GLOBAL')
        } else {
          // 筛选指定食堂
          filtered = filtered.filter((admin) => admin.scope === 'GLOBAL' || admin.canteenIds.includes(canteenFilter.value))
        }
      }

      return filtered
    })

    // 密码强度计算
    const passwordStrength = computed(() => {
      const password = formData.password
      if (!password) return 0
      let strength = 0
      if (password.length >= 8) strength++
      if (/[a-z]/.test(password)) strength++
      if (/[A-Z]/.test(password)) strength++
      if (/[0-9]/.test(password)) strength++
      if (/[^a-zA-Z0-9]/.test(password)) strength++
      return strength
    })

    const passwordStrengthClass = computed(() => {
      if (passwordStrength.value <= 2) return 'bg-red-500'
      if (passwordStrength.value <= 4) return 'bg-orange-500'
      return 'bg-green-500'
    })

    const passwordStrengthWidth = computed(() => {
      return (passwordStrength.value / 5) * 100 + '%'
    })

    const passwordStrengthText = computed(() => {
      if (passwordStrength.value <= 2) return '密码强度：弱'
      if (passwordStrength.value <= 4) return '密码强度：中'
      return '密码强度：强'
    })

    // 获取角色标签
    const getRoleLabel = (role) => {
      if (!role || role === 'admin') return '普通管理员'
      if (role === 'superadmin') return '系统超级管理员'
      const roleObj = roles.find((r) => r.value === role)
      return roleObj ? roleObj.label : role
    }

    // 加载食堂列表
    const loadCanteens = async () => {
      try {
        const response = await canteenApi.getCanteenOptions()
        if (response.code === 200 && response.data) {
          canteenList.value = response.data.items || []
        }
      } catch (error) {
        console.error('加载食堂列表失败:', error)
      }
    }

    // 加载子管理员列表
    const loadAdmins = async () => {
      loading.value = true
      try {
        const response = await permissionApi.getAdmins({
          page: currentPage.value,
          pageSize: pageSize.value,
        })

        if (response.code === 200 && response.data) {
          adminList.value = response.data.items || []
          totalPages.value = response.data.meta?.totalPages || 1
          total.value = response.data.meta?.total ?? 0
        } else {
          throw new Error(response.message || '获取管理员列表失败')
        }
      } catch (error) {
        console.error('加载子管理员列表失败:', error)
        notify.error('加载子管理员列表失败，请刷新重试')
        adminList.value = []
      } finally {
        loading.value = false
      }
    }

    // 创建新管理员
    const createNewAdmin = () => {
      editingAdmin.value = null
      resetForm()
      viewMode.value = 'edit'
    }

    // 编辑管理员
    const editAdmin = async (admin) => {
      editingAdmin.value = admin
      // 填充表单数据
      formData.username = admin.username || ''
      
      // 判断是否为预设角色
      if (admin.role && admin.role !== 'admin') {
        const presetRoleValues = roles.map(r => r.value)
        const isPresetRole = presetRoleValues.includes(admin.role)
        
        if (isPresetRole) {
          formData.role = admin.role
          formData.customRole = ''
        } else {
          // 如果不是预设角色，则视为自定义角色
          formData.role = 'custom'
          formData.customRole = admin.role
        }
      } else {
        // 如果没有角色，保持为空
        formData.role = ''
        formData.customRole = ''
      }
      
      formData.scope = admin.scope
      formData.canteenIds = [...admin.canteenIds]

      // 加载权限信息
      // 后端已为 superadmin 返回所有权限，前端只需检查权限列表
      const currentUserPermissions = authStore.permissions || []
      
      if (admin.permissions && Array.isArray(admin.permissions)) {
         const allAdminPermissions = admin.permissions.map(p => typeof p === 'string' ? p : p.permission)
         // 只保留当前用户拥有的权限（编辑时也要过滤）
         formData.permissions = allAdminPermissions.filter(p => currentUserPermissions.includes(p))
      } else {
         formData.permissions = []
      }

      viewMode.value = 'edit'
    }

    // 停用选中的管理员账号
    const deleteAdmin = async (admin) => {
      if (admin.directReportCount) {
        if (!authStore.hasPermission('admin:edit')) {
          notify.error('该账号有下属，请由具备人员编辑权限的管理员完成移交后停用')
          return
        }
        await openHandover(admin, true)
        return
      }
      const confirmed = await showConfirmDanger(
        `确定停用管理员“${admin.username}”吗？该账号的登录权限立即失效，下属账号继续有效，历史操作记录保留。`,
        '确认停用',
        '确认停用'
      )
      if (!confirmed) {
        return
      }

      try {
        const response = await permissionApi.deleteAdmin(admin.id)
        if (response.code === 200) {
          notify.success('管理员已停用')
          loadAdmins()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('停用子管理员失败:', error)
        notify.error(error instanceof Error ? error.message : '停用子管理员失败，请重试')
      }
    }

    const closeHandover = () => {
      if (handoverSubmitting.value) return
      handoverTarget.value = null
      handoverError.value = ''
    }

    const openHandover = async (admin, retireSource = false) => {
      handoverTarget.value = admin
      const target = handoverTarget.value
      handoverManagerId.value = ''
      handoverRetireSource.value = retireSource
      handoverError.value = ''
      handoverCandidates.value = []
      handoverLoading.value = true
      try {
        const candidates = []
        let page = 1
        let pages = 1
        do {
          const response = await permissionApi.getAdmins({ page, pageSize: 100 })
          if (response.code !== 200 || !response.data) throw new Error(response.message || '加载负责人失败')
          candidates.push(...response.data.items)
          pages = response.data.meta.totalPages
          page += 1
        } while (page <= pages)
        if (handoverTarget.value !== target) return
        const byId = new Map(candidates.map(candidate => [candidate.id, candidate]))
        const outsideSource = candidate => {
          const visited = new Set()
          let current = candidate
          while (current && !visited.has(current.id)) {
            if (current.id === admin.id) return false
            visited.add(current.id)
            current = byId.get(current.managerId)
          }
          return true
        }
        const self = authStore.user
        handoverCandidates.value = [...(self?.id ? [self] : []), ...candidates]
          .filter((candidate, index, list) => !candidate.deletedAt && outsideSource(candidate) && list.findIndex(item => item.id === candidate.id) === index)
      } catch (error) {
        if (handoverTarget.value === target) handoverError.value = error instanceof Error ? error.message : '加载负责人失败'
      } finally {
        if (handoverTarget.value === target) handoverLoading.value = false
      }
    }

    const submitHandover = async () => {
      if (!handoverTarget.value || !handoverManagerId.value || handoverSubmitting.value) return
      handoverSubmitting.value = true
      handoverError.value = ''
      try {
        const response = await permissionApi.handoverAdmin(handoverTarget.value.id, handoverManagerId.value, handoverRetireSource.value)
        if (response.code !== 200) throw new Error(response.message || '移交失败')
        notify.success(handoverRetireSource.value ? '下属已移交，原负责人已停用' : '下属已移交')
        handoverTarget.value = null
        await loadAdmins()
      } catch (error) {
        handoverError.value = error instanceof Error ? error.message : '移交失败，请重试'
      } finally {
        handoverSubmitting.value = false
      }
    }

    // 返回列表
    const backToList = () => {
      viewMode.value = 'list'
      editingAdmin.value = null
      resetForm()
    }

    // 重置表单
    const resetForm = () => {
      formData.username = ''
      formData.password = generateAdminPassword()
      formData.role = ''
      formData.customRole = ''
      formData.scope = authStore.user?.scope || 'CANTEENS'
      formData.canteenIds = [...(authStore.user?.canteenIds || [])]
      formData.permissions = []
    }

    const generatePassword = () => { formData.password = generateAdminPassword() }

    // 选择角色
    const selectRole = (role) => {
      // 如果点击已选中的角色，则取消选择
      if (formData.role === role) {
        formData.role = ''
        formData.customRole = ''
        return
      }
      
      formData.role = role
      if (role === 'custom') {
        // 自定义角色不清空权限，让用户手动选择
        formData.customRole = ''
      } else if (role) {
        // 根据角色设置默认权限
        formData.permissions = getDefaultPermissionsByRole(role)
        formData.customRole = ''
      } else {
        // 普通管理员，不清空权限，让用户手动选择
        formData.customRole = ''
      }
    }

    // 根据角色获取默认权限（只返回当前用户拥有的权限）
    // 后端已为 superadmin 返回所有权限，前端只需检查权限列表
    const getDefaultPermissionsByRole = (role) => {
      const currentUserPermissions = authStore.permissions || []
      
      const permissionMap = {
        full_access: permissionGroups.value
          .flatMap((g) => g.permissions.map((p) => p.id))
          .filter(p => currentUserPermissions.includes(p)),
        canteen_manager: [
          'dish:view',
          'dish:create',
          'dish:edit',
          'dish:delete',
          'canteen:view',
          'upload:approve',
          'news:view',
          'news:create',
          'review:approve',
          'comment:approve',
        ].filter(p => currentUserPermissions.includes(p)),
        restaurant_manager: [
          'dish:view',
          'dish:create',
          'dish:edit',
          'canteen:view',
          'upload:approve',
        ].filter(p => currentUserPermissions.includes(p)),
        kitchen_operator: ['dish:view', 'dish:create', 'dish:edit', 'canteen:view']
          .filter(p => currentUserPermissions.includes(p)),
        news_editor: [
          'news:view',
          'news:create',
          'news:edit',
          'news:publish',
          'news:revoke',
          'news:delete',
          'canteen:view', // 新闻可能关联食堂
        ].filter(p => currentUserPermissions.includes(p)),
        auditor: [
          'review:approve',
          'review:delete',
          'comment:approve',
          'comment:delete',
          'report:handle',
          'upload:approve',
          'dish:view', // 审核需要查看菜品
          'canteen:view', // 审核需要查看食堂
        ].filter(p => currentUserPermissions.includes(p)),
      }
      return permissionMap[role] || []
    }

    // 切换权限（只能选择当前用户拥有的权限）
    // 后端已为 superadmin 返回所有权限，前端只需检查权限列表
    const togglePermission = (permissionId) => {
      const currentUserPermissions = authStore.permissions || []
      
      // 检查当前用户是否有该权限
      if (!currentUserPermissions.includes(permissionId)) {
        errors.permissions = '您没有该权限，无法分配给子管理员'
        return
      } else {
        errors.permissions = ''
      }
      
      const index = formData.permissions.indexOf(permissionId)
      if (index > -1) {
        // 取消选中
        formData.permissions = removePermissionDependents(formData.permissions, [permissionId])
      } else {
        const permissionsToAdd = getPermissionClosure([permissionId])
        const unavailableDependencies = permissionsToAdd.filter(
          (permission) => !currentUserPermissions.includes(permission),
        )

        if (unavailableDependencies.length > 0) {
          errors.permissions = `缺少依赖权限，无法分配：${unavailableDependencies.join(', ')}`
          return
        }

        permissionsToAdd.forEach((permission) => {
          if (!formData.permissions.includes(permission)) {
            formData.permissions.push(permission)
          }
        })
      }
    }

    // 检查权限是否选中
    const isPermissionChecked = (permissionId) => {
      return formData.permissions.includes(permissionId)
    }

    const selectedGroupPermissionCount = group => group.permissions.filter(
      permission => formData.permissions.includes(permission.id),
    ).length
    const isGroupSelected = group => selectedGroupPermissionCount(group) === group.permissions.length
    const isGroupPartiallySelected = group => {
      const selected = selectedGroupPermissionCount(group)
      return selected > 0 && selected < group.permissions.length
    }
    const assignablePermissionIds = computed(() => permissionGroups.value.flatMap(group => group.permissions.map(permission => permission.id)))
    const selectedPermissionCount = computed(() => assignablePermissionIds.value.filter(permission => formData.permissions.includes(permission)).length)
    const isAllPermissionsSelected = computed(() => assignablePermissionIds.value.length > 0 && selectedPermissionCount.value === assignablePermissionIds.value.length)
    const isSomePermissionsSelected = computed(() => selectedPermissionCount.value > 0 && !isAllPermissionsSelected.value)

    const removePermissionDependents = (selected, removed) => selected.filter(permission =>
      !getPermissionClosure([permission]).some(dependency => removed.includes(dependency)))

    const toggleGroupPermissions = group => {
      const ids = group.permissions.map(permission => permission.id)
      if (isGroupSelected(group)) {
        formData.permissions = removePermissionDependents(formData.permissions, ids)
      } else {
        const closure = getPermissionClosure([...formData.permissions, ...ids])
        const unavailable = closure.filter(permission => !authStore.permissions.includes(permission))
        if (unavailable.length) { errors.permissions = `缺少依赖权限，无法分配：${unavailable.join(', ')}`; return }
        formData.permissions = closure
      }
    }

    // 切换所有权限全选/取消（只操作当前用户拥有的权限）
    const toggleAllPermissions = () => {
      const allPermissions = permissionGroups.value.flatMap((g) => g.permissions.map((p) => p.id))
      
      if (isAllPermissionsSelected.value) {
        // 取消全选：清空所有权限
        formData.permissions = []
      } else {
        // 全选：添加所有当前用户拥有的权限
        formData.permissions = getPermissionClosure(allPermissions)
      }
    }

    // 提交表单
    const submitForm = async () => {
      const finalRole = formData.role === 'custom' ? (formData.customRole.trim() || 'admin') : (formData.role || 'admin')
      // 清除之前的错误
      errors.username = ''
      errors.password = ''
      errors.permissions = ''
      errors.customRole = ''
      errors.scope = ''
      
      // 表单验证
      let hasError = false
      
      if (!formData.username || !formData.username.trim()) {
        errors.username = '请填写用户名'
        hasError = true
      }

      if (!editingAdmin.value && (!formData.password || !formData.password.trim())) {
        errors.password = '请填写初始密码'
        hasError = true
      }

      if (formData.scope === 'CANTEENS' && !formData.canteenIds.length) {
        errors.scope = '请至少选择一个食堂'
        hasError = true
      }

      // 验证权限：创建管理员时至少需要选择一个权限
      if (!editingAdmin.value && (!formData.permissions || formData.permissions.length === 0)) {
        errors.permissions = '请至少选择一个权限'
        hasError = true
      }

      // 验证：只能分配当前用户拥有的权限
      // 后端已为 superadmin 返回所有权限，前端只需检查权限列表
      const currentUserPermissions = authStore.permissions || []
      
      if (formData.permissions && formData.permissions.length > 0) {
        if ((formData.scope !== 'GLOBAL') && formData.permissions.some(permission => authStore.authorization.globalOnly.includes(permission))) {
          errors.permissions = '学生身份审核、社区管理和推荐实验权限仅可分配给全局管理范围，请调整范围或取消相关权限'
          hasError = true
        }
        const invalidPermissions = formData.permissions.filter(p => !currentUserPermissions.includes(p))
        if (invalidPermissions.length > 0) {
          errors.permissions = `您没有以下权限，无法分配给子管理员：${invalidPermissions.join(', ')}`
          hasError = true
        }

        const missingDependencies = getPermissionClosure(formData.permissions).filter(
          (permission) => !formData.permissions.includes(permission),
        )
        if (missingDependencies.length > 0) {
          errors.permissions = `所选权限缺少依赖：${missingDependencies.join(', ')}`
          hasError = true
        }
      }

      if (['superadmin', 'super_admin'].includes(finalRole)) {
        errors.customRole = '该角色名称由系统保留，请选择其他名称'
        hasError = true
      }

      // 验证自定义角色名称长度
      if (formData.role === 'custom' && formData.customRole && formData.customRole.trim()) {
        if (formData.customRole.trim().length > 50) {
          errors.customRole = '自定义角色名称不能超过50个字符'
          hasError = true
        }
      }
      
      if (hasError) {
        return
      }

      if (isSubmitting.value) {
        return
      }

      isSubmitting.value = true

      try {
        if (editingAdmin.value) {
          // 更新管理员权限
          const response = await permissionApi.updateAdminPermissions(
            editingAdmin.value.id,
            formData.permissions,
            formData.scope,
            formData.scope === 'GLOBAL' ? [] : formData.canteenIds,
            finalRole,
          )

          if (response.code === 200) {
            notify.success('权限配置已更新！')
            await loadAdmins()
            backToList()
          } else {
            throw new Error(response.message || '更新权限失败')
          }
        } else {
          // 创建新管理员
          const createData = {
            username: formData.username.trim(),
            password: formData.password.trim(),
            scope: formData.scope,
            canteenIds: formData.scope === 'GLOBAL' ? [] : formData.canteenIds,
            permissions: formData.permissions,
            role: finalRole,
          }

          const response = await permissionApi.createAdmin(createData)

          if (response.code === 200 && response.data) {
            notify.success('子管理员创建成功！')
            await loadAdmins()
            backToList()
          } else {
            throw new Error(response.message || '创建子管理员失败')
          }
        }
      } catch (error) {
        console.error('保存失败:', error)
        notify.error(error instanceof Error ? error.message : '保存失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }

    // 切换页码
    const changePage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        saveState() // 保存状态
        loadAdmins()
      }
    }

    // 处理筛选变化
    const handleFilterChange = () => {
      // 筛选是客户端进行的，不需要重新加载数据
      // 但可以重置到第一页（如果需要分页的话）
      currentPage.value = 1
      saveState() // 保存状态
    }

    // 重置筛选
    const resetFilters = () => {
      searchQuery.value = ''
      canteenFilter.value = ''
      currentPage.value = 1
      saveState() // 保存状态
      loadAdmins() // 重新加载数据以应用重置后的筛选条件
    }

    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    }

    // 密码验证函数
    const validatePassword = (password) => {
      // 密码验证：至少8位，包含大小写字母、数字和特殊符号
      if (password.length < 8) {
        return '密码长度至少为8位'
      }
      if (!/[a-z]/.test(password)) {
        return '密码必须包含小写字母'
      }
      if (!/[A-Z]/.test(password)) {
        return '密码必须包含大写字母'
      }
      if (!/\d/.test(password)) {
        return '密码必须包含数字'
      }
      if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
        return '密码必须包含特殊符号'
      }
      return null
    }

    // ======== 重置子管理员密码相关方法 ========
    const openResetPasswordModal = (admin) => {
      resetPasswordTarget.value = admin
      resetPasswordForm.newPassword = ''
      resetPasswordForm.confirmPassword = ''
      resetPasswordError.value = ''
      showResetPasswordModal.value = true
    }

    const closeResetPasswordModal = () => {
      showResetPasswordModal.value = false
      resetPasswordTarget.value = null
      resetPasswordError.value = ''
    }

    const generateResetPassword = () => { const password = generateAdminPassword(); resetPasswordForm.newPassword = password; resetPasswordForm.confirmPassword = password }

    const handleResetPassword = async () => {
      resetPasswordError.value = ''
      
      if (!resetPasswordTarget.value) {
        resetPasswordError.value = '未选择目标管理员'
        return
      }
      
      if (!resetPasswordForm.newPassword) {
        resetPasswordError.value = '请输入新密码'
        return
      }
      
      const passwordError = validatePassword(resetPasswordForm.newPassword)
      if (passwordError) {
        resetPasswordError.value = passwordError
        return
      }
      
      if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
        resetPasswordError.value = '两次输入的新密码不一致'
        return
      }
      
      isResettingPassword.value = true
      
      try {
        const response = await permissionApi.changeSubAdminPassword(
          resetPasswordTarget.value.id,
          resetPasswordForm.newPassword
        )
        
        if (response.code === 200) {
          notify.success(`${resetPasswordTarget.value.username} 的密码已重置成功！`)
          closeResetPasswordModal()
        } else {
          resetPasswordError.value = response.message || '密码重置失败'
        }
      } catch (error) {
        console.error('重置密码失败:', error)
        resetPasswordError.value = error?.response?.data?.message || '密码重置失败，请重试'
      } finally {
        isResettingPassword.value = false
      }
    }

    onMounted(() => {
      loadCanteens()
      loadAdmins()
    })

    onActivated(() => {
      // 组件重新激活时仅重新加载数据，状态已在setup()中恢复
      loadCanteens()
      loadAdmins()
    })

    return {
      viewMode,
      editingAdmin,
      adminList,
      searchQuery,
      canteenFilter,
      filteredAdmins,
      formData,
      errors,
      roles,
      permissionGroups,
      isSubmitting,
      loading,
      currentPage,
      totalPages,
      total,
      pageSize,
      passwordStrengthClass,
      passwordStrengthWidth,
      passwordStrengthText,
      loadAdmins,
      createNewAdmin,
      editAdmin,
      deleteAdmin,
      openHandover,
      closeHandover,
      submitHandover,
      handoverTarget,
      handoverManagerId,
      handoverRetireSource,
      handoverCandidates,
      handoverLoading,
      handoverSubmitting,
      handoverError,
      backToList,
      generatePassword,
      selectRole,
      togglePermission,
      isPermissionChecked,
      toggleAllPermissions,
      isGroupSelected,
      toggleGroupPermissions,
      isAllPermissionsSelected,
      isSomePermissionsSelected,
      assignablePermissionIds,
      selectedPermissionCount,
      selectedGroupPermissionCount,
      isGroupPartiallySelected,
      submitForm,
      changePage,
      handleFilterChange,
      resetFilters,
      formatDate,
      getRoleLabel,
      formatAdminScope,
      canteenList,
      authStore,
      // 重置子管理员密码相关
      showResetPasswordModal,
      isResettingPassword,
      resetPasswordError,
      resetPasswordTarget,
      resetPasswordForm,
      resetPasswordChecks,
      openResetPasswordModal,
      closeResetPasswordModal,
      generateResetPassword,
      handleResetPasswordInput,
      handleResetPassword,
    }
  },
}
</script>
