<!-- @/components/FilterBar.vue -->
<template>
  <div class="flex flex-wrap py-3">
    <div class="tag active"><span>口味</span></div>
    <div class="tag"><span>价格</span></div>
    <div class="tag"><span>评分</span></div>
    <div class="tag"><span>荤素</span></div>
    <div class="tag"><span>过敏原</span></div>
  </div>
</template>

<style scoped>
.tag {
  display: inline-flex;
  align-items: center;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 100px;
  height: 32px;
  padding: 0 12px;
  font-size: 14px;
  margin-right: 8px;
  cursor: pointer;
}
.tag.active {
  border-color: #82318E;
  background: #F3E5F5;
}
</style>