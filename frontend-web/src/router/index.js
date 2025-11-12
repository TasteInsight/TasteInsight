import { createRouter, createWebHistory } from 'vue-router'
import SingleAdd from '../views/SingleAdd.vue'
import BatchAdd from '../views/BatchAdd.vue'
import ModifyDish from '../views/ModifyDish.vue'
import ReviewDish from '../views/ReviewDish.vue'

const routes = [
  {
    path: '/',
    redirect: '/single-add'
  },
  {
    path: '/single-add',
    name: 'SingleAdd',
    component: SingleAdd
  },
  {
    path: '/batch-add',
    name: 'BatchAdd',
    component: BatchAdd
  },
  {
    path: '/modify-dish',
    name: 'ModifyDish',
    component: ModifyDish
  },
  {
    path: '/review-dish',
    name: 'ReviewDish',
    component: ReviewDish
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router