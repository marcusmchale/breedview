<script setup>
import { ref, computed } from 'vue'
import { useOntologySchema } from '@/composables/ontology/useOntologySchema'

const props = defineProps({
  isCollapsed: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['create-entry'])

const localIsCollapsed = ref(props.isCollapsed)

const { getCreateEntriesForLabels } = useOntologySchema()
const createEntriesForLabels = computed(() => getCreateEntriesForLabels().value)

const toggleCollapse = () => {
  localIsCollapsed.value = !localIsCollapsed.value
}

const handleCreateEntry = (typename) => {
  emit('create-entry', typename)
}
</script>

<template>
  <div class="buttons-panel" :class="{ collapsed: localIsCollapsed }">
    <div class="panel-header">
      <button
        @click="toggleCollapse"
        class="collapse-btn"
        :title="localIsCollapsed ? 'Expand buttons' : 'Collapse buttons'"
      >
        <span class="collapse-icon">{{ localIsCollapsed ? '◀' : '▶' }}</span>
      </button>
    </div>

    <div v-if="!localIsCollapsed" class="panel-content">
      <section class="buttons-section">
        <h4 class="section-title">Create Entries</h4>
        <div class="entry-buttons">
          <button
            v-for="(entry, index) in createEntriesForLabels"
            :key="index"
            :title="`${entry.description} (${entry.code})`"
            :style="{ backgroundColor: entry.color, color: 'white' }"
            class="entry-btn"
            @click="handleCreateEntry(entry.typename)"
          >
            {{ entry.label }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.buttons-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-left: 1px solid #e0e0e0;
  overflow: visible;
  transition: width 0.3s ease, min-width 0.3s ease;
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  max-height: 100%;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
}

.buttons-panel.collapsed {
  width: 40px;
  min-width: 40px;
  border-left: 1px solid #e0e0e0;
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

.buttons-panel.collapsed .panel-header {
  writing-mode: horizontal-tb;
  text-orientation: initial;
  padding: 0.5rem;
  flex-direction: column-reverse;
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

.buttons-section {
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

.entry-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.entry-btn {
  padding: 0.6rem 0.75rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: white;
}

.entry-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.entry-btn:active {
  opacity: 0.8;
  transform: translateY(0);
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