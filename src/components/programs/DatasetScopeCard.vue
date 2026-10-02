<script setup>
import { computed } from 'vue'

const props = defineProps({
  scope: { type: Object, required: true },
  index: { type: Number, default: 0 },
  summaries: { type: Array, default: () => [] }
})

defineEmits(['remove'])

const datasets = computed(() =>
  (props.scope.datasetIds || []).map((id) => ({
    id,
    summary: props.summaries.find((s) => String(s.id) === String(id)) || null
  }))
)

const totalRecords = computed(() =>
  datasets.value.reduce((sum, d) => sum + (d.summary?.record_count || 0), 0)
)
</script>

<template>
  <div class="scope-card">
    <div class="scope-header">
      <div class="scope-title">
        Scope {{ index + 1 }}
        <span class="scope-meta">
          {{ datasets.length }} dataset{{ datasets.length === 1 ? '' : 's' }}, {{ totalRecords }} records
        </span>
      </div>
      <button type="button" class="btn-remove" title="Remove scope" @click="$emit('remove')">
        ✕
      </button>
    </div>

    <ul class="dataset-list">
      <li v-for="d in datasets" :key="d.id">
        <template v-if="d.summary">
          <strong>{{ d.summary.concept?.name || 'Unknown concept' }}</strong>
          <span class="dataset-id">#{{ d.id }}</span>
          <span class="dataset-meta">
            — {{ d.summary.unit_count ?? '—' }} units, {{ d.summary.record_count ?? '—' }} records
            <template v-if="d.summary.start || d.summary.end">
              ({{ d.summary.start || '?' }} to {{ d.summary.end || '?' }})
            </template>
          </span>
        </template>
        <template v-else>
          <span class="dataset-missing">Dataset #{{ d.id }} (not found in this study)</span>
        </template>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.scope-card {
  padding: 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.scope-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
}

.scope-title {
  font-weight: 600;
  color: #333;
  font-size: 0.9rem;
}

.scope-meta {
  font-weight: normal;
  color: #666;
  font-size: 0.8rem;
  margin-left: 6px;
}

.dataset-list {
  margin: 0;
  padding-left: 18px;
  font-size: 0.85rem;
  color: #555;
}

.dataset-list li { margin: 2px 0; }

.dataset-id {
  color: #999;
  font-size: 0.8rem;
  margin-left: 4px;
}

.dataset-meta { color: #666; }

.dataset-missing {
  color: #e65100;
  font-style: italic;
}

.btn-remove {
  background: none;
  border: none;
  color: #f44336;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 2px 4px;
}

.btn-remove:hover { opacity: 0.7; }
</style>