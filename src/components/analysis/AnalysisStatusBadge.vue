<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: { type: String, default: null }
})

const STATUSES = {
  PENDING: { label: 'Pending', kind: 'running' },
  PROCESSING: { label: 'Processing', kind: 'running' },
  QUEUED: { label: 'Queued', kind: 'running' },
  COMPLETED: { label: 'Completed', kind: 'good' },
  FAILED: { label: 'Failed', kind: 'critical' }
}

const info = computed(() => STATUSES[props.status] ?? { label: props.status ?? 'Unknown', kind: 'unknown' })
</script>

<template>
  <span class="status-badge" :class="info.kind">
    <span class="icon" aria-hidden="true">{{ { running: '◌', good: '✓', critical: '✕', unknown: '?' }[info.kind] }}</span>
    {{ info.label }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.running {
  background: #eff6ff;
  color: #1e40af;
}

.running .icon {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}

.good {
  background: #f0fdf4;
  color: #006300;
}

.critical {
  background: #fef2f2;
  color: #b91c1c;
}

.unknown {
  background: #f3f4f6;
  color: #52514e;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>