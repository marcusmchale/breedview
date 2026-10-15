<script setup>
import { computed } from 'vue'

const props = defineProps({
  grouping: {
    type: Object,
    required: true
  },
  typeName: {
    type: String,
    required: true
  },
  editable: {
    type: Boolean,
    default: false
  }
})

defineEmits(['edit', 'delete'])

const scopeLabel = computed(() => {
  const scope = props.grouping.scope
  return scope === 'STUDY_WIDE' ? 'Study-wide' : 'Dataset-scoped'
})

const scopeCount = computed(() => {
  if (props.grouping.scope === 'DATASET_SCOPED') {
    return props.grouping.dataset_scopes?.length || 0
  }
  return null
})
</script>

<template>
  <div class="grouping-card">
    <div class="card-header">
      <div class="card-title">
        <h4>{{ grouping.name }}</h4>
        <span class="scope-badge" :class="grouping.scope.toLowerCase()">
          {{ scopeLabel }}
        </span>
      </div>
      <div v-if="editable" class="card-actions">
        <button class="btn-icon" @click="$emit('edit')" title="Edit">✏️</button>
        <button class="btn-icon delete" @click="$emit('delete')" title="Delete">🗑️</button>
      </div>
    </div>

    <div class="card-content">
      <p><strong>Type:</strong> {{ typeName }}</p>
      <p v-if="grouping.scope === 'DATASET_SCOPED'" class="scopes-info">
        <strong>Dataset Scopes:</strong> {{ scopeCount || 'None configured' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.grouping-card {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fafafa;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.card-title h4 {
  margin: 0;
  font-size: 1rem;
  color: #333;
}

.scope-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  color: white;
}

.scope-badge.study_wide {
  background: #4caf50;
}

.scope-badge.dataset_scoped {
  background: #2196f3;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: none;
  font-size: 1rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.btn-icon:hover {
  background: #e0e0e0;
}

.btn-icon.delete:hover {
  background: #ffebee;
}

.card-content {
  padding: 12px;
}

.card-content p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: #666;
}

.scopes-info {
  color: #2196f3;
  font-weight: 500;
}
</style>