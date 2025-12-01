<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-x-auto overflow-y-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen min-w-[1200px]">
        <div class="bg-white rounded-lg container-shadow p-8">
          <!-- 列表视图 -->
          <div v-if="viewMode === 'list'">
            <div class="flex justify-between items-center mb-6">
              <Header 
                title="人员权限管理" 
                description="管理子管理员账号和权限分配"
                header-icon="clarity:group-line"
              />
              <button 
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center"
                @click="createNewAdmin"
              >
                <span class="iconify mr-1" data-icon="carbon:add"></span>
                创建子管理员
              </button>
            </div>
            
            <!-- 搜索栏 -->
            <div class="mb-6">
              <input 
                type="text" 
                v-model="searchQuery"
                placeholder="搜索用户名、角色..."
                class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
              >
            </div>
            
            <!-- 管理员列表表格 -->
            <div class="overflow-auto">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">用户名</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">角色</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">管理范围</th>
                    <th class="py-3 px-6 text-left text-sm font-medium text-gray-500">创建时间</th>
                    <th class="py-3 px-6 text-center text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr 
                    v-for="admin in filteredAdmins" 
                    :key="admin.id"
                    class="hover:bg-gray-50"
                  >
                    <td class="py-4 px-6">
                      <div class="font-medium">{{ admin.username }}</div>
                    </td>
                    <td class="py-4 px-6">
                      <span class="px-2 py-1 text-xs rounded-full bg-tsinghua-purple/10 text-tsinghua-purple">
                        {{ getRoleLabel(admin.role) }}
                      </span>
                    </td>
                    <td class="py-4 px-6 text-sm">{{ admin.canteenId || '全校食堂' }}</td>
                    <td class="py-4 px-6 text-sm text-gray-500">{{ formatDate(admin.createdAt) }}</td>
                    <td class="py-4 px-6 text-center" @click.stop>
                      <div class="flex items-center justify-center gap-2">
                        <button 
                          class="p-2 rounded-full hover:bg-gray-200 text-tsinghua-purple"
                          @click="editAdmin(admin)"
                          title="编辑权限"
                        >
                          <span class="iconify" data-icon="carbon:edit"></span>
                        </button>
                        <button 
                          class="p-2 rounded-full hover:bg-gray-200 text-red-500"
                          @click="deleteAdmin(admin)"
                          title="删除"
                        >
                          <span class="iconify" data-icon="carbon:trash-can"></span>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- 空状态 -->
            <div v-if="filteredAdmins.length === 0 && !loading" class="text-center py-12">
              <span class="iconify text-6xl text-gray-300 mx-auto" data-icon="clarity:group-line"></span>
              <p class="mt-4 text-gray-500">暂无子管理员</p>
              <button 
                class="mt-4 px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200"
                @click="createNewAdmin"
              >
                创建第一个子管理员
              </button>
            </div>
            
            <!-- 分页 -->
            <div v-if="totalPages > 1" class="flex justify-center gap-2 mt-6">
              <button
                @click="changePage(currentPage - 1)"
                :disabled="currentPage === 1"
                class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                上一页
              </button>
              <button
                v-for="page in totalPages"
                :key="page"
                @click="changePage(page)"
                class="px-4 py-2 border rounded-lg transition"
                :class="currentPage === page ? 'bg-tsinghua-purple text-white border-tsinghua-purple' : 'border-gray-300 hover:bg-gray-50'"
              >
                {{ page }}
              </button>
              <button
                @click="changePage(currentPage + 1)"
                :disabled="currentPage === totalPages"
                class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                下一页
              </button>
            </div>
          </div>
          
          <!-- 创建/编辑视图 -->
          <div v-else>
            <div class="flex justify-between items-center mb-6">
              <Header 
                :title="editingAdmin ? '编辑子管理员' : '创建子管理员'" 
                :description="editingAdmin ? '修改子管理员信息和权限' : '创建新的子管理员账号并分配权限'"
                header-icon="clarity:group-line"
              />
              <button 
                class="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                @click="backToList"
              >
                返回列表
              </button>
            </div>
            
            <form class="space-y-6">
              <div class="grid grid-cols-2 gap-6">
                <!-- 左侧列 -->
                <div>
                  <!-- 用户名 -->
                  <div class="mb-6">
                    <label class="block text-gray-700 font-medium mb-2">
                      用户名 <span class="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      v-model="formData.username" 
                      class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                      placeholder="例如：admin001"
                      :disabled="!!editingAdmin"
                      required
                    >
                    <p v-if="editingAdmin" class="mt-1 text-sm text-gray-500">用户名创建后不可修改</p>
                  </div>
                  
                  <!-- 密码 -->
                  <div v-if="!editingAdmin" class="mb-6">
                    <label class="block text-gray-700 font-medium mb-2">
                      初始密码 <span class="text-red-500">*</span>
                    </label>
                    <div class="flex gap-2">
                      <input
                        v-model="formData.password"
                        type="text"
                        class="flex-1 px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple"
                        placeholder="请输入密码"
                      />
                      <button
                        type="button"
                        @click="generatePassword"
                        class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
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
                  </div>
                  
                  <!-- 角色 -->
                  <div class="mb-6">
                    <label class="block text-gray-700 font-medium mb-2">
                      角色 <span class="text-red-500">*</span>
                    </label>
                    <div class="grid grid-cols-2 gap-3">
                      <div
                        v-for="role in roles"
                        :key="role.value"
                        @click="selectRole(role.value)"
                        class="p-3 border rounded-lg cursor-pointer transition"
                        :class="formData.role === role.value ? 'border-tsinghua-purple bg-purple-50' : 'border-gray-200 hover:border-gray-300'"
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
                    </div>
                  </div>
                  
                  <!-- 管理范围 -->
                  <div class="mb-6">
                    <label class="block text-gray-700 font-medium mb-2">管理范围（食堂ID）</label>
                    <input 
                      type="text" 
                      v-model="formData.canteenId" 
                      class="w-full px-4 py-2 border rounded-lg focus:ring-tsinghua-purple focus:border-tsinghua-purple" 
                      placeholder="留空表示管理全校食堂"
                    >
                    <p class="mt-1 text-sm text-gray-500">输入食堂ID，留空则管理所有食堂</p>
                  </div>
                </div>
                
                <!-- 右侧列 -->
                <div>
                  <!-- 权限配置 -->
                  <div class="mb-6">
                    <div class="flex justify-between items-center mb-2">
                      <label class="block text-gray-700 font-medium">权限配置</label>
                      <button 
                        type="button" 
                        class="text-tsinghua-purple text-sm flex items-center hover:text-tsinghua-dark"
                        @click="selectAllPermissions"
                      >
                        <span class="iconify mr-1" data-icon="carbon:checkbox-checked"></span>
                        全选
                      </button>
                    </div>
                    
                    <div class="space-y-4 max-h-[500px] overflow-y-auto border rounded-lg p-4">
                      <div v-for="permissionGroup in permissionGroups" :key="permissionGroup.id" class="mb-4">
                        <div class="flex items-center gap-2 mb-3">
                          <div class="w-1 h-5 bg-tsinghua-purple"></div>
                          <h4 class="text-sm font-medium text-gray-800">{{ permissionGroup.name }}</h4>
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
                              class="w-4 h-4 text-tsinghua-purple border-gray-300 rounded focus:ring-tsinghua-purple"
                            />
                            <label :for="permission.id" class="text-sm text-gray-700 cursor-pointer">
                              {{ permission.label }}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- 表单按钮 -->
              <div class="flex space-x-4 pt-6 border-t border-gray-200">
                <button 
                  type="button" 
                  class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition duration-200 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="submitForm"
                  :disabled="isSubmitting"
                >
                  <span class="iconify mr-1" data-icon="carbon:save"></span>
                  {{ isSubmitting ? '提交中...' : (editingAdmin ? '保存修改' : '创建子管理员') }}
                </button>
                <button 
                  type="button" 
                  class="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition duration-200"
                  @click="backToList"
                >
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { reactive, ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { permissionApi } from '@/api/modules/permission'
import { useAuthStore } from '@/store/modules/use-auth-store'
import Sidebar from '@/components/Layout/Sidebar.vue'
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'UserManage',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const router = useRouter()
    const authStore = useAuthStore()
    const isSubmitting = ref(false)
    const loading = ref(false)
    const viewMode = ref('list') // 'list' 或 'edit'
    const editingAdmin = ref(null) // 当前编辑的管理员
    const adminList = ref([]) // 子管理员列表
    const searchQuery = ref('')
    const currentPage = ref(1)
    const pageSize = ref(10)
    const totalPages = ref(1)
    
    const formData = reactive({
      username: '',
      password: '',
      role: 'canteen_manager',
      canteenId: '',
      permissions: []
    })
    
    const roles = [
      { value: 'super_admin', label: '超级管理员', desc: '系统所有权限' },
      { value: 'canteen_manager', label: '食堂主管', desc: '管理多个食堂' },
      { value: 'restaurant_manager', label: '餐厅经理', desc: '单个食堂管理' },
      { value: 'kitchen_operator', label: '后厨操作员', desc: '菜品与库存管理' }
    ]
    
    const permissionGroups = [
      {
        id: 'dishes',
        name: '菜品管理',
        code: 'FR-M-2',
        permissions: [
          { id: 'dishes-view', label: '浏览菜品列表' },
          { id: 'dishes-create', label: '新建菜品' },
          { id: 'dishes-edit', label: '编辑菜品' },
          { id: 'dishes-delete', label: '删除菜品' },
          { id: 'dishes-status', label: '修改菜品状态' }
        ]
      },
      {
        id: 'review',
        name: '内容审核',
        code: 'FR-M-3',
        permissions: [
          { id: 'review-dishes', label: '审核菜品评价' },
          { id: 'review-comments', label: '审核评论' },
          { id: 'review-reports', label: '处理举报' },
          { id: 'review-user-dishes', label: '审核用户上传菜品' }
        ]
      },
      {
        id: 'admin',
        name: '权限管理',
        code: 'FR-M-4',
        permissions: [
          { id: 'admin-create', label: '创建子管理员' },
          { id: 'admin-delete', label: '删除子管理员' },
          { id: 'admin-permission', label: '权限分配与授予' }
        ]
      },
      {
        id: 'audit',
        name: '操作审计',
        code: 'FR-M-5',
        permissions: [
          { id: 'audit-log', label: '记录操作日志' },
          { id: 'audit-view', label: '查看操作日志' }
        ]
      },
      {
        id: 'news',
        name: '新闻管理',
        code: 'FR-M-6',
        permissions: [
          { id: 'news-view', label: '浏览新闻列表' },
          { id: 'news-create', label: '创建新闻' },
          { id: 'news-edit', label: '编辑新闻' },
          { id: 'news-delete', label: '删除新闻' }
        ]
      }
    ]
    
    // 过滤后的管理员列表
    const filteredAdmins = computed(() => {
      if (!searchQuery.value) {
        return adminList.value
      }
      const query = searchQuery.value.toLowerCase()
      return adminList.value.filter(admin => 
        admin.username.toLowerCase().includes(query) ||
        (admin.role && admin.role.toLowerCase().includes(query))
      )
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
      return (passwordStrength.value / 5 * 100) + '%'
    })
    
    const passwordStrengthText = computed(() => {
      if (passwordStrength.value <= 2) return '密码强度：弱'
      if (passwordStrength.value <= 4) return '密码强度：中'
      return '密码强度：强'
    })
    
    // 获取角色标签
    const getRoleLabel = (role) => {
      const roleObj = roles.find(r => r.value === role)
      return roleObj ? roleObj.label : role
    }
    
    // 加载子管理员列表
    const loadAdmins = async () => {
      loading.value = true
      try {
        const response = await permissionApi.getAdmins({
          page: currentPage.value,
          pageSize: pageSize.value
        })
        
        if (response.code === 200 && response.data) {
          adminList.value = response.data.items || []
          totalPages.value = response.data.meta?.totalPages || 1
        } else {
          throw new Error(response.message || '获取管理员列表失败')
        }
      } catch (error) {
        console.error('加载子管理员列表失败:', error)
        alert('加载子管理员列表失败，请刷新重试')
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
      formData.role = admin.role || 'canteen_manager'
      formData.canteenId = admin.canteenId || ''
      
      // 加载权限信息（如果接口支持）
      // 注意：这里假设可以通过其他接口获取权限，如果没有，可能需要从其他地方获取
      // 暂时使用空数组，用户需要重新选择权限
      formData.permissions = []
      
      viewMode.value = 'edit'
    }
    
    // 删除管理员
    const deleteAdmin = async (admin) => {
      if (!confirm(`确定要删除子管理员"${admin.username}"吗？此操作不可恢复！`)) {
        return
      }
      
      try {
        const response = await permissionApi.deleteAdmin(admin.id)
        if (response.code === 200) {
          alert('删除成功！')
          loadAdmins()
        } else {
          throw new Error(response.message || '删除失败')
        }
      } catch (error) {
        console.error('删除子管理员失败:', error)
        alert(error instanceof Error ? error.message : '删除子管理员失败，请重试')
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
      formData.password = 'Tsinghua@2025'
      formData.role = 'canteen_manager'
      formData.canteenId = ''
      formData.permissions = []
    }
    
    // 生成随机密码
    const generatePassword = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      formData.password = password
    }
    
    // 选择角色
    const selectRole = (role) => {
      formData.role = role
      // 根据角色设置默认权限
      formData.permissions = getDefaultPermissionsByRole(role)
    }
    
    // 根据角色获取默认权限
    const getDefaultPermissionsByRole = (role) => {
      const permissionMap = {
        super_admin: permissionGroups.flatMap(g => g.permissions.map(p => p.id)),
        canteen_manager: [
          'dishes-view', 'dishes-create', 'dishes-edit', 'dishes-delete', 'dishes-status',
          'review-user-dishes', 'audit-log', 'audit-view'
        ],
        restaurant_manager: [
          'dishes-view', 'dishes-create', 'dishes-edit', 'dishes-status',
          'review-user-dishes', 'audit-log'
        ],
        kitchen_operator: [
          'dishes-view', 'dishes-create', 'dishes-edit', 'dishes-status'
        ]
      }
      return permissionMap[role] || []
    }
    
    // 切换权限
    const togglePermission = (permissionId) => {
      const index = formData.permissions.indexOf(permissionId)
      if (index > -1) {
        formData.permissions.splice(index, 1)
      } else {
        formData.permissions.push(permissionId)
      }
    }
    
    // 检查权限是否选中
    const isPermissionChecked = (permissionId) => {
      return formData.permissions.includes(permissionId)
    }
    
    // 全选权限
    const selectAllPermissions = () => {
      const allPermissions = permissionGroups.flatMap(g => g.permissions.map(p => p.id))
      formData.permissions = [...allPermissions]
    }
    
    // 提交表单
    const submitForm = async () => {
      // 表单验证
      if (!formData.username || !formData.username.trim()) {
        alert('请填写用户名')
        return
      }
      
      if (!editingAdmin.value && (!formData.password || !formData.password.trim())) {
        alert('请填写初始密码')
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
            formData.permissions
          )
          
          if (response.code === 200) {
            alert('权限配置已更新！')
            await loadAdmins()
            backToList()
          } else {
            throw new Error(response.message || '更新权限失败')
          }
        } else {
          // 创建新管理员
          // Note: 后端不接受role字段，子管理员的role固定为'admin'
          const createData = {
            username: formData.username.trim(),
            password: formData.password.trim(),
            canteenId: formData.canteenId.trim() || undefined,
            permissions: formData.permissions
          }
          
          const response = await permissionApi.createAdmin(createData)
          
          if (response.code === 200 && response.data) {
            alert('子管理员创建成功！')
            await loadAdmins()
            backToList()
          } else {
            throw new Error(response.message || '创建子管理员失败')
          }
        }
      } catch (error) {
        console.error('保存失败:', error)
        alert(error instanceof Error ? error.message : '保存失败，请重试')
      } finally {
        isSubmitting.value = false
      }
    }
    
    // 切换页码
    const changePage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        loadAdmins()
      }
    }
    
    // 格式化日期
    const formatDate = (dateString) => {
      if (!dateString) return '-'
      const date = new Date(dateString)
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    }
    
    onMounted(() => {
      loadAdmins()
    })
    
    return {
      viewMode,
      editingAdmin,
      adminList,
      searchQuery,
      filteredAdmins,
      formData,
      roles,
      permissionGroups,
      isSubmitting,
      loading,
      currentPage,
      totalPages,
      passwordStrengthClass,
      passwordStrengthWidth,
      passwordStrengthText,
      loadAdmins,
      createNewAdmin,
      editAdmin,
      deleteAdmin,
      backToList,
      generatePassword,
      selectRole,
      togglePermission,
      isPermissionChecked,
      selectAllPermissions,
      submitForm,
      changePage,
      formatDate,
      getRoleLabel
    }
  }
}
</script>
