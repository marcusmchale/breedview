<script setup>
import RecentAnalysisItem from '@/components/analysis/RecentAnalysisItem.vue'

defineProps({
  ids: { type: Array, required: true },
  selectedId: { type: String, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'new', 'refresh'])
</script>

<template>
  <aside class="recent panel">
    <div class="recent-header">
      <h3 class="section-title">Recent analyses</h3>
      <button type="button" class="btn-link" title="Refresh" @click="emit('refresh')">Refresh</button>
    </div>
    <div class="new-action">
      <button type="button" class="btn btn-sm btn-primary" @click="emit('new')">+ New analysis</button>
    </div>
    <p v-if="loading && ids.length === 0" class="hint pad">Loading…</p>
    <p v-else-if="ids.length === 0" class="hint pad">No recent analyses.</p>
    <ul>
      <RecentAnalysisItem
        v-for="id in ids"
        :key="id"
        :analysis-id="id"
        :selected="id === selectedId"
        @select="emit('select', $event)"
      />
    </ul>
    <p class="hint pad">Analyses expire some days after their last status change (7 by default).</p>
  </aside>
</template>

<style scoped>
.recent {
  overflow: hidden;
}

.recent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 12px 0;
}

.recent-header .section-title {
  margin: 0;
}

.new-action {
  padding: 12px;
}

.new-action .btn {
  width: 100%;
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--an-border);
}

.pad {
  padding: 8px 12px;
}
</style>
