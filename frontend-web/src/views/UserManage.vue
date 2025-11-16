<template>
  <div class="w-full min-h-screen flex container-shadow rounded-lg bg-white overflow-hidden">
    <Sidebar />
    
    <div class="flex-1 min-h-screen overflow-auto bg-tsinghua-light ml-[260px]">
      <div class="p-8 min-h-screen">
        <div class="bg-white rounded-lg container-shadow p-8">
          <Header 
            title="人员管理与权限配置" 
            description="超级管理员账号：admin@mails.tsinghua.edu.cn"
            header-icon="clarity:group-line"
          />
          
          <!-- 统计卡片 -->
          <div class="grid grid-cols-4 gap-6 mt-6">
            <div class="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
              <div class="text-3xl font-bold text-tsinghua-purple mb-2">{{ stats.totalUsers }}</div>
              <div class="text-sm text-gray-600">总用户数</div>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
              <div class="text-3xl font-bold text-tsinghua-purple mb-2">{{ stats.activeUsers }}</div>
              <div class="text-sm text-gray-600">活跃用户</div>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
              <div class="text-3xl font-bold text-tsinghua-purple mb-2">{{ stats.pendingUsers }}</div>
              <div class="text-sm text-gray-600">待激活用户</div>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg p-5 text-center shadow-sm">
              <div class="text-3xl font-bold text-tsinghua-purple mb-2">{{ stats.adminRoles }}</div>
              <div class="text-sm text-gray-600">管理员角色</div>
            </div>
          </div>
          
          <!-- 创建新用户表单 -->
          <div class="bg-white border border-gray-200 rounded-lg p-6 mt-6 shadow-sm">
            <h3 class="text-lg font-medium text-gray-800 mb-4">创建新用户账号</h3>
            
            <div class="grid grid-cols-2 gap-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">用户姓名</label>
                <input
                  v-model="newUserForm.name"
                  type="text"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none"
                  placeholder="请输入姓名"
                />
                
                <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">邮箱账号</label>
                <input
                  v-model="newUserForm.email"
                  type="email"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none"
                  placeholder="邮箱将作为登录账号"
                />
                
                <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">用户部门</label>
                <input
                  v-model="newUserForm.department"
                  type="text"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none"
                  placeholder="所在部门或食堂"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">联系方式</label>
                <input
                  v-model="newUserForm.phone"
                  type="tel"
                  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none"
                  placeholder="手机号码"
                />
                
                <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">初始密码</label>
                <div class="flex gap-2">
                  <input
                    v-model="newUserForm.password"
                    type="text"
                    class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-tsinghua-purple focus:border-transparent outline-none"
                    placeholder="请输入密码"
                  />
                  <button
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
                
                <label class="block text-sm font-medium text-gray-700 mb-2 mt-4">权限角色</label>
                <div class="grid grid-cols-2 gap-3">
                  <div
                    v-for="role in roles"
                    :key="role.value"
                    @click="selectRole(role.value)"
                    class="p-3 border rounded-lg cursor-pointer transition"
                    :class="newUserForm.role === role.value ? 'border-tsinghua-purple bg-purple-50' : 'border-gray-200 hover:border-gray-300'"
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="radio"
                        :value="role.value"
                        v-model="newUserForm.role"
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
            </div>
            
            <div class="flex justify-end gap-3 mt-6">
              <button
                @click="resetNewUserForm"
                class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                取消
              </button>
              <button
                @click="handleCreateUser"
                class="px-6 py-2 bg-tsinghua-purple text-white rounded-lg hover:bg-tsinghua-dark transition"
              >
                创建用户账号
              </button>
            </div>
          </div>
          
          <!-- 用户列表和权限配置 -->
          <div class="grid grid-cols-3 gap-6 mt-6">
            <!-- 用户列表 -->
            <div class="col-span-2 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 class="text-lg font-medium text-gray-800 mb-4">用户信息列表</h3>
              
              <div class="overflow-x-auto">
                <table class="w-full">
                  <thead class="bg-gray-50">
                    <tr>
                      <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">用户名</th>
                      <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">用户角色</th>
                      <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">账号状态</th>
                      <th class="px-4 py-3 text-left text-sm font-medium text-gray-700">管理范围</th>
                      <th class="px-4 py-3 text-center text-sm font-medium text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200">
                    <tr v-for="user in adminList" :key="user.id" class="hover:bg-gray-50">
                      <td class="px-4 py-3">
                        <div class="font-medium">{{ user.name || user.username }}</div>
                        <div class="text-xs text-gray-500">{{ user.email }}</div>
                        <div class="text-xs text-gray-400">最后登录: {{ formatTime(user.lastLogin) }}</div>
                      </td>
                      <td class="px-4 py-3 text-sm">{{ user.role || '管理员' }}</td>
                      <td class="px-4 py-3">
                        <span
                          class="px-2 py-1 text-xs rounded-full"
                          :class="user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'"
                        >
                          {{ user.status === 'active' ? '激活中' : '待激活' }}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-sm">{{ user.canteenName || '全校食堂' }}</td>
                      <td class="px-4 py-3">
                        <div class="flex justify-center gap-2">
                          <button
                            @click="editUser(user)"
                            class="p-1 text-gray-600 hover:text-tsinghua-purple transition"
                            title="编辑"
                          >
                            <span class="iconify" data-icon="mdi:pencil"></span>
                          </button>
                          <button
                            @click="resetPassword(user)"
                            class="p-1 text-gray-600 hover:text-tsinghua-purple transition"
                            title="重置密码"
                          >
                            <span class="iconify" data-icon="mdi:lock-reset"></span>
                          </button>
                          <button
                            @click="deleteUser(user)"
                            class="p-1 text-gray-600 hover:text-red-600 transition"
                            title="删除"
                          >
                            <span class="iconify" data-icon="mdi:trash-can-outline"></span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              <!-- 分页 -->
              <div class="flex justify-center gap-2 mt-6">
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
            
            <!-- 权限概览 -->
            <div class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 class="text-lg font-medium text-gray-800 mb-4">权限概览</h3>
              
              <div v-for="role in roleStats" :key="role.name" class="mb-4">
                <div class="flex justify-between mb-2 text-sm">
                  <span>{{ role.name }}</span>
                  <span>{{ role.count }}人</span>
                </div>
                <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    class="h-full transition-all"
                    :style="{ width: role.percentage + '%', backgroundColor: role.color }"
                  ></div>
                </div>
              </div>
              
              <div class="mt-6">
                <h4 class="text-sm font-medium text-gray-700 mb-3">快速操作</h4>
                <div class="space-y-2">
                  <button class="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left flex items-center gap-2 text-sm">
                    <span class="iconify" data-icon="mdi:account-multiple-plus"></span>
                    批量添加用户
                  </button>
                  <button class="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left flex items-center gap-2 text-sm">
                    <span class="iconify" data-icon="mdi:lock-reset"></span>
                    批量重置密码
                  </button>
                  <button class="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left flex items-center gap-2 text-sm">
                    <span class="iconify" data-icon="mdi:download"></span>
                    导出用户列表
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 权限配置 -->
          <div v-if="selectedUser" class="bg-white border border-gray-200 rounded-lg p-6 mt-6 shadow-sm">
            <h3 class="text-lg font-medium text-gray-800 mb-4">
              权限配置 - <span class="text-tsinghua-purple">{{ selectedUser.name || selectedUser.username }}</span>
            </h3>
            
            <div v-for="permissionGroup in permissionGroups" :key="permissionGroup.id" class="mb-6">
              <div class="flex items-center gap-2 mb-4">
                <div class="w-1 h-6 bg-tsinghua-purple"></div>
                <h4 class="text-base font-medium text-gray-800">{{ permissionGroup.name }} ({{ permissionGroup.code }})</h4>
              </div>
              
              <div class="grid grid-cols-3 gap-4">
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
            
            <div class="flex gap-3 mt-6">
              <button
                @click="savePermissions"
                class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
              >
                <span class="iconify" data-icon="mdi:check"></span>
                保存权限配置
              </button>
              <button
                @click="resetPermissions"
                class="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                重置为默认方案
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, computed, onMounted } from 'vue'
import { api } from '@/api';
import Sidebar from '@/components/Layout/Sidebar.vue';
import Header from '@/components/Layout/Header.vue'

export default {
  name: 'UserManage',
  components: {
    Sidebar,
    Header
  },
  setup() {
    const stats = reactive({
      totalUsers: 24,
      activeUsers: 18,
      pendingUsers: 4,
      adminRoles: 5
    })
    
    const newUserForm = reactive({
      name: '',
      email: '',
      department: '',
      phone: '',
      password: 'Tsinghua@2025',
      role: 'super_admin'
    })
    
    const roles = [
      { value: 'super_admin', label: '超级管理员', desc: '系统所有权限' },
      { value: 'canteen_manager', label: '食堂主管', desc: '管理多个食堂' },
      { value: 'restaurant_manager', label: '餐厅经理', desc: '单个食堂管理' },
      { value: 'kitchen_operator', label: '后厨操作员', desc: '菜品与库存管理' }
    ]
    
    const adminList = ref([])
    const selectedUser = ref(null)
    const selectedPermissions = ref([])
    const currentPage = ref(1)
    const pageSize = ref(10)
    const totalPages = ref(1)
    const loading = ref(false)
    
    const roleStats = computed(() => {
      const counts = adminList.value.reduce((acc, user) => {
        const role = user.role || 'other'
        acc[role] = (acc[role] || 0) + 1
        return acc
      }, {})
      
      return [
        { name: '超级管理员', count: counts.super_admin || 0, percentage: 10, color: '#660099' },
        { name: '食堂主管', count: counts.canteen_manager || 0, percentage: 20, color: '#FF9500' },
        { name: '餐厅经理', count: counts.restaurant_manager || 0, percentage: 40, color: '#34C759' },
        { name: '后厨操作员', count: counts.kitchen_operator || 0, percentage: 50, color: '#007AFF' }
      ]
    })
    
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
    
    const passwordStrength = computed(() => {
      const password = newUserForm.password
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
    
    // 获取管理员列表
    const fetchAdmins = async () => {
      loading.value = true
      try {
        const response = await api.getAdmins({
          page: currentPage.value,
          pageSize: pageSize.value
        })
        
        // 根据实际接口返回格式调整
        adminList.value = response.data || response.list || []
        totalPages.value = response.totalPages || response.pages || 1
        
        // 模拟数据（如果接口未返回）
        if (adminList.value.length === 0) {
          adminList.value = [
            {
              id: '1',
              name: '郑教授',
              username: 'zheng',
              email: 'zheng@tsinghua.edu.cn',
              role: 'canteen_manager',
              status: 'active',
              canteenName: '全校食堂',
              lastLogin: new Date(Date.now() - 10 * 60 * 60 * 1000)
            },
            {
              id: '2',
              name: '餐饮部李主任',
              username: 'li',
              email: 'li@tsinghua.edu.cn',
              role: 'restaurant_manager',
              status: 'active',
              canteenName: '紫荆食堂',
              lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000)
            },
            {
              id: '3',
              name: '周厨师长',
              username: 'zhou',
              email: 'zhou@tsinghua.edu.cn',
              role: 'kitchen_operator',
              status: 'active',
              canteenName: '桃李食堂二层',
              lastLogin: new Date(Date.now() - 5 * 60 * 60 * 1000)
            }
          ]
        }
      } catch (error) {
        console.error('获取管理员列表失败:', error)
        // 使用模拟数据
        adminList.value = [
          {
            id: '1',
            name: '郑教授',
            username: 'zheng',
            email: 'zheng@tsinghua.edu.cn',
            role: 'canteen_manager',
            status: 'active',
            canteenName: '全校食堂',
            lastLogin: new Date(Date.now() - 10 * 60 * 60 * 1000)
          }
        ]
      } finally {
        loading.value = false
      }
    }
    
    // 生成随机密码
    const generatePassword = () => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?'
      let password = ''
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      newUserForm.password = password
    }
    
    // 选择角色
    const selectRole = (role) => {
      newUserForm.role = role
    }
    
    // 创建用户
    const handleCreateUser = async () => {
      if (!newUserForm.name || !newUserForm.email || !newUserForm.password) {
        alert('请填写完整信息')
        return
      }
      
      try {
        await api.createAdmin({
          username: newUserForm.email,
          password: newUserForm.password,
          canteenId: newUserForm.department,
          permissions: getDefaultPermissionsByRole(newUserForm.role)
        })
        
        alert('创建用户成功！')
        resetNewUserForm()
        fetchAdmins()
      } catch (error) {
        alert('创建用户失败：' + error.message)
      }
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
    
    // 重置表单
    const resetNewUserForm = () => {
      newUserForm.name = ''
      newUserForm.email = ''
      newUserForm.department = ''
      newUserForm.phone = ''
      newUserForm.password = 'Tsinghua@2025'
      newUserForm.role = 'super_admin'
    }
    
    // 编辑用户
    const editUser = (user) => {
      selectedUser.value = user
      selectedPermissions.value = user.permissions || []
    }
    
    // 重置密码
    const resetPassword = async (user) => {
      if (confirm(`确定要重置用户 ${user.name || user.username} 的密码吗？`)) {
        // TODO: 调用重置密码接口
        alert('密码重置功能开发中...')
      }
    }
    
    // 删除用户
    const deleteUser = async (user) => {
      if (confirm(`确定要删除用户 ${user.name || user.username} 吗？`)) {
        try {
          await api.deleteAdmin(user.id)
          alert('删除成功！')
          fetchAdmins()
        } catch (error) {
          alert('删除失败：' + error.message)
        }
      }
    }
    
    // 切换权限
    const togglePermission = (permissionId) => {
      const index = selectedPermissions.value.indexOf(permissionId)
      if (index > -1) {
        selectedPermissions.value.splice(index, 1)
      } else {
        selectedPermissions.value.push(permissionId)
      }
    }
    
    // 检查权限是否选中
    const isPermissionChecked = (permissionId) => {
      return selectedPermissions.value.includes(permissionId)
    }
    
    // 保存权限
    const savePermissions = async () => {
      if (!selectedUser.value) return
      
      try {
        await api.updateAdminPermissions(selectedUser.value.id, selectedPermissions.value)
        alert('权限配置保存成功！')
        fetchAdmins()
      } catch (error) {
        alert('保存失败：' + error.message)
      }
    }
    
    // 重置权限
    const resetPermissions = () => {
      if (selectedUser.value && confirm('确定要重置权限配置为默认方案吗？')) {
        selectedPermissions.value = getDefaultPermissionsByRole(selectedUser.value.role)
      }
    }
    
    // 切换页码
    const changePage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        fetchAdmins()
      }
    }
    
    // 格式化时间
    const formatTime = (date) => {
      if (!date) return '从未登录'
      const d = new Date(date)
      const now = new Date()
      const diff = now - d
      const hours = Math.floor(diff / (1000 * 60 * 60))
      if (hours < 1) return '刚刚'
      if (hours < 24) return `${hours}小时前`
      const days = Math.floor(hours / 24)
      return `${days}天前`
    }
    
    onMounted(() => {
      fetchAdmins()
    })
    
    return {
      stats,
      newUserForm,
      roles,
      adminList,
      selectedUser,
      selectedPermissions,
      currentPage,
      totalPages,
      roleStats,
      permissionGroups,
      passwordStrengthClass,
      passwordStrengthWidth,
      passwordStrengthText,
      generatePassword,
      selectRole,
      handleCreateUser,
      resetNewUserForm,
      editUser,
      resetPassword,
      deleteUser,
      togglePermission,
      isPermissionChecked,
      savePermissions,
      resetPermissions,
      changePage,
      formatTime
    }
  }
}
</script>

