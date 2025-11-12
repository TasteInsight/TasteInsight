// API工具函数
export const api = {
  // 模拟API调用
  async getDishes() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 1, name: '示例菜品', canteen: '紫荆园', status: 'active' }
        ])
      }, 500)
    })
  },
  
  async addDish(dishData) {
    console.log('添加菜品:', dishData)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, id: Date.now() })
      }, 500)
    })
  },
  
  async updateDish(id, dishData) {
    console.log('更新菜品:', id, dishData)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, 500)
    })
  },
  
  async deleteDish(id) {
    console.log('删除菜品:', id)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true })
      }, 500)
    })
  },
  
  async uploadExcel(file) {
    console.log('上传Excel文件:', file.name)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ 
          success: true, 
          data: [
            { id: 1, name: '麻婆豆腐', canteen: '紫荆园', status: '有效' }
          ] 
        })
      }, 1000)
    })
  }
}

export default api