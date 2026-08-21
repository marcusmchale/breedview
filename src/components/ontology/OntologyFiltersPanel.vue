<script setup>
import { ref, computed } from 'vue'
import { useOntologySchema } from '@/composables/ontology/useOntologySchema'

const props = defineProps({
  selectedLabels: {
    type: Array,
    default: () => []
  },
  selectedPhases: {
    type: Array,
    default: () => []
  },
  availablePhases: {
    type: Array,
    default: () => ['DRAFT', 'ACTIVE', 'DEPRECATED', 'REMOVED']
  },
  lifecycleFilters: {
    type: Boolean,
    default: true
  },
  isCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update-labels', 'update-phases'])

const localIsCollapsed = ref(props.isCollapsed)

const { getCreateEntriesForLabels } = useOntologySchema()
const createEntriesForLabels = computed(() => getCreateEntriesForLabels().value)

const togglePhaseSelection = (phase) => {
  const newSelection = props.selectedPhases.includes(phase)
    ? props.selectedPhases.filter(p => p !== phase)
    : [...props.selectedPhases, phase]
  emit('update-phases', newSelection)
}

const toggleLabelFilter = (label) => {
  const newSelection = props.selectedLabels.includes(label)
    ? props.selectedLabels.filter(l => l !== label)
    : [...props.selectedLabels, label]
  emit('update-labels', newSelection)
}

const toggleCollapse = () => {
  localIsCollapsed.value = !localIsCollapsed.value
}
</script>

<template>
  <div class="filters-panel" :class="{ collapsed: localIsCollapsed }">
    <div class="panel-header">
      <button
        @click="toggleCollapse"
        class="collapse-btn"
        :title="localIsCollapsed ? 'Expand filters' : 'Collapse filters'"
      >
        <span class="collapse-icon">{{ localIsCollapsed ? '▶' : '◀' }}</span>
      </button>
    </div>

    <div v-if="!localIsCollapsed" class="panel-content">
      <!-- Life Cycle Phases Filter -->
      <section v-if="lifecycleFilters" class="filter-section">
        <h4 class="section-title">Filter Phases</h4>
        <div class="filter-buttons">
          <button
            v-for="phase in availablePhases"
            :key="phase"
            @click="togglePhaseSelection(phase)"
            :class="{ 'btn-active': selectedPhases.includes(phase) }"
            class="filter-btn phase-btn"
            :title="`Filter by ${phase}`"
          >
            {{ phase }}
          </button>
        </div>
      </section>

      <!-- Ontology Labels Filter -->
      <section class="filter-section">
        <h4 class="section-title">Filter Labels</h4>
        <div class="filter-buttons">
          <button
            v-for="(entry, index) in createEntriesForLabels"
            :key="index"
            @click="toggleLabelFilter(entry.enumLabel)"
            :style="{
              backgroundColor: entry.color,
              opacity: selectedLabels.length === 0 || selectedLabels.includes(entry.enumLabel) ? 1 : 0.3
            }"
            :class="{ 'btn-active': selectedLabels.length === 0 || selectedLabels.includes(entry.enumLabel) }"
            class="filter-btn label-btn"
            :title="`${entry.description} (${entry.code})`"
          >
            {{ entry.label }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
<style scoped>
.filters-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-right: 1px solid #e0e0e0;
  overflow: visible;
  transition: width 0.3s ease, min-width 0.3s ease;
  width: 280px;
  min-width: 280px;
  max-height: 100%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters-panel.collapsed {
  width: 40px;
  min-width: 40px;
  border-right: 1px solid #e0e0e0;
  overflow: visible;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
  flex-shrink: 0;
  writing-mode: vertical-rl;
  text-orientation: mixed;
}

.filters-panel.collapsed .panel-header {
  writing-mode: horizontal-tb;
  text-orientation: initial;
  padding: 0.5rem;
  flex-direction: column-reverse;
}

.panel-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filters-panel.collapsed .panel-title {
  display: none;
}

.collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background-color: #e8e8e8;
  color: #333;
}

.collapse-icon {
  font-size: 12px;
  font-weight: bold;
}

.panel-content {
  padding: 1rem;
  overflow-y: auto;
  flex: 1;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.filter-section:last-child {
  margin-bottom: 0;
}

.section-title {
  margin: 0 0 0.75rem 0;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.filter-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.filter-btn {
  padding: 0.6rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.phase-btn {
  background-color: #f5f5f5;
  color: #333;
}

.phase-btn:hover {
  background-color: #e8e8e8;
}

.phase-btn.btn-active {
  background-color: #4caf50;
  color: white;
  border-color: #45a049;
}

.label-btn {
  color: white;
  border: none;
  transition: opacity 0.2s;
}

.label-btn:hover {
  opacity: 0.9;
}

.label-btn.btn-active {
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1) inset;
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 6px;
}

.panel-content::-webkit-scrollbar-track {
  background: transparent;
}

.panel-content::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>