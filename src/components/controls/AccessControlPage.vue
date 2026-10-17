<script setup>
import { ref } from 'vue'

import TransfersPanel from './TransfersPanel.vue'
import BulkControlPanel from './BulkControlPanel.vue'

// Access control: control transfers, and the control of many records at once
const tab = ref('transfers')
</script>

<template>
  <div class="page-container access-control-page">
    <h2>Access control</h2>

    <div class="page-tabs" role="tablist">
      <button class="page-tab" role="tab" :class="{ active: tab === 'transfers' }" @click="tab = 'transfers'">Transfers</button>
      <button class="page-tab" role="tab" :class="{ active: tab === 'bulk' }" @click="tab = 'bulk'">Bulk control</button>
    </div>

    <TransfersPanel v-if="tab === 'transfers'" />
    <BulkControlPanel v-else />
  </div>
</template>

<style scoped>
.access-control-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 2px solid #dee2e6;
}

.page-tab {
  padding: 10px 18px;
  border: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  background: none;
  font-size: 1rem;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
}

.page-tab.active {
  color: #212529;
  border-bottom-color: #4caf50;
}
</style>
