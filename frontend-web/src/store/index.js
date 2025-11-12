import { defineStore } from 'pinia'

export const useDishStore = defineStore('dish', {
  state: () => ({
    dishes: [],
    currentDish: null,
    searchQuery: '',
    filterOptions: {
      canteen: '',
      status: ''
    }
  }),
  getters: {
    filteredDishes: (state) => {
      let filtered = state.dishes
      
      if (state.searchQuery) {
        filtered = filtered.filter(dish => 
          dish.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          dish.canteen.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
          dish.window.toLowerCase().includes(state.searchQuery.toLowerCase())
        )
      }
      
      if (state.filterOptions.canteen) {
        filtered = filtered.filter(dish => dish.canteen === state.filterOptions.canteen)
      }
      
      if (state.filterOptions.status) {
        filtered = filtered.filter(dish => dish.status === state.filterOptions.status)
      }
      
      return filtered
    }
  },
  actions: {
    setSearchQuery(query) {
      this.searchQuery = query
    },
    setFilterOptions(options) {
      this.filterOptions = { ...this.filterOptions, ...options }
    },
    addDish(dish) {
      this.dishes.push({
        id: Date.now(),
        ...dish
      })
    },
    updateDish(id, updatedDish) {
      const index = this.dishes.findIndex(dish => dish.id === id)
      if (index !== -1) {
        this.dishes[index] = { ...this.dishes[index], ...updatedDish }
      }
    },
    deleteDish(id) {
      this.dishes = this.dishes.filter(dish => dish.id !== id)
    }
  }
})