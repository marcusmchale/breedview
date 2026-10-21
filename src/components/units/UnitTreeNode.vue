<script setup>
import { ref, computed, watch } from 'vue'

import { useUnitNodeQueries } from '@/composables/units/unitNodeQueries'
import { currentPosition } from '@/composables/units/unitPositions'
import UnitTreeNode from "@/components/units/UnitTreeNode.vue";

const props = defineProps({
  unitId: {
    type: String,
    required: true
  },
  selectedNodeId: {
    type: String,
    default: null
  },
  // the location the tree is shown at: children whose own position now is elsewhere are links to where they are
  contextLocationId: {
    type: String,
    default: null
  },
  // units to open, e.g. the way down to a unit a link led to
  expandIds: {
    type: Set,
    default: () => new Set()
  }
})

const emit = defineEmits(['node-selected'])

const {
  unit,
  unitLoading,
  unitError,
  childUnits,
  loadChildUnits,
  childUnitsLoading,
  childUnitsError
} = useUnitNodeQueries({ unitId: props.unitId })

// Expanded state for tree
const expanded = ref(false)
// The children are loaded in one query and only rendered once it has returned, so that each child
// node finds its unit in the cache instead of sending a request of its own
const childrenReady = ref(false)
const toggleExpand = async () => {
  expanded.value = !expanded.value
  if (expanded.value && !childrenReady.value) {
    try {
      const loading = loadChildUnits(props.unitId)
      if (loading) await loading
    } finally {
      childrenReady.value = true
    }
  }
}

// opened once for each way down it is on, so that closing it again stays closed
let openedFor = null
watch([() => props.expandIds, unit], () => {
  if (openedFor === props.expandIds || !unit.value?.children?.length || !props.expandIds.has(props.unitId)) return
  openedFor = props.expandIds
  if (!expanded.value) toggleExpand()
}, { immediate: true })

const handleNodeClick = () => {
  emit('node-selected', { nodeId: props.unitId })
}

// a location the user cannot read is a placeholder: a unit there can't be followed, so it stays listed
const isHidden = (location) => location?.name === 'REDACTED'

// The unit's own position now, or its last one when that has ended; none for a unit where its parent is
const current = computed(() => currentPosition(unit.value?.positions))
const elsewhere = computed(() => {
  const location = current.value?.position?.location
  return location && props.contextLocationId && location.id !== props.contextLocationId ? location : null
})

// Once loaded, the children whose own position now is at another location are summarised by it, as links there
const awayChildren = computed(() => {
  if (!childrenReady.value || !props.contextLocationId) return []
  return (childUnits.value ?? []).filter((child) => {
    const location = currentPosition(child.positions)?.position?.location
    return location && !isHidden(location) && location.id !== props.contextLocationId
  })
})
const awayIds = computed(() => new Set(awayChildren.value.map((child) => child.id)))
const awayByLocation = computed(() => {
  const byLocation = new Map()
  for (const child of awayChildren.value) {
    const location = currentPosition(child.positions).position.location
    const entry = byLocation.get(location.id) ?? { location, count: 0 }
    entry.count += 1
    byLocation.set(location.id, entry)
  }
  return [...byLocation.values()].sort((a, b) => (a.location.name ?? '').localeCompare(b.location.name ?? ''))
})
const childrenHere = computed(() => (unit.value?.children ?? []).filter((child) => !awayIds.value.has(child.id)))
</script>

<template>
  <div class="tree-node">
    <div v-if="unitLoading" class="loading">Loading...</div>
    <div v-else-if="unitError" class="error">
      Error loading unit: {{ unitError.message }}
    </div>
    <div v-else-if="unit">
      <div
        class="node-header"
        :class="{
          selected: selectedNodeId === unitId,
          redacted: !unit.subject
        }"
        @click="handleNodeClick"
      >
        <button
          v-if="unit.children && unit.children.length > 0"
          @click.stop="toggleExpand"
          class="expand-btn"
          :class="{ expanded }"
        >
          ▶
        </button>
        <div v-else class="expand-placeholder"></div>

        <div class="node-info">
          <span class="node-name">
            {{ unit.name || (unit.subject ? `${unit.subject.name} ${unit.id}` : `Unit ${unit.id}`) }}
          </span>
          <div class="node-meta">
            <span v-if="unit.subject" class="type-badge">{{ unit.subject.name }}</span>
            <span v-if="unit.germplasm" class="germplasm-badge">{{ unit.germplasm.name }}</span>
            <span
              v-else-if="unit.inheritedGermplasm"
              class="inherited-germplasm-badge"
              :title="`From ${unit.inheritedGermplasm.unit.name || `unit ${unit.inheritedGermplasm.unit.id}`}`"
            >{{ unit.inheritedGermplasm.germplasm.name }}</span>
            <span v-if="!unit.subject" class="redacted-badge">Access Restricted</span>
            <span v-if="elsewhere && isHidden(elsewhere)" class="place-badge">now elsewhere</span>
            <router-link
              v-else-if="elsewhere"
              class="place-badge"
              :to="{ name: 'Units', query: { location: elsewhere.id, unit: unitId } }"
              @click.stop
            >now at {{ elsewhere.name }}</router-link>
            <span v-else-if="current?.ended" class="ended-badge">until {{ current.position.end }}</span>
            <span v-if="unit.children && unit.children.length > 0" class="count">
              {{ unit.children.length }} child{{ unit.children.length !== 1 ? 'ren' : '' }}<template
                v-if="awayChildren.length"> · {{ awayChildren.length }} elsewhere</template>
            </span>
          </div>
        </div>
      </div>

      <div v-if="expanded && unit.children && unit.children.length > 0" class="children">
        <div v-if="childUnitsLoading || !childrenReady" class="loading">Loading children...</div>
        <div v-else-if="childUnitsError" class="error">
          Error loading children: {{ childUnitsError.message }}
        </div>
        <template v-else>
          <router-link
            v-for="away in awayByLocation"
            :key="`away_${away.location.id}`"
            class="away-link"
            :to="{ name: 'Units', query: { location: away.location.id, from: unitId } }"
          >↗ {{ away.count }} at {{ away.location.name }}</router-link>
          <UnitTreeNode
            v-for="child in childrenHere"
            :key="child.id"
            :unitId="child.id"
            :selectedNodeId="selectedNodeId"
            :contextLocationId="contextLocationId"
            :expandIds="expandIds"
            @node-selected="$emit('node-selected', $event)"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.node-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.node-header:hover {
  background-color: #f5f5f5;
  border-color: #bbb;
}

.node-header.selected {
  background-color: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
}

.node-header.redacted {
  background-color: #fff3e0;
  border-color: #ffb74d;
}

.expand-btn,
.expand-placeholder {
  min-width: 20px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: #666;
  font-size: 10px;
  transition: transform 0.2s;
}

.expand-btn.expanded {
  transform: rotate(90deg);
}

.expand-btn:hover {
  color: #333;
}

.node-info {
  flex: 1;
  min-width: 0;
}

.node-name {
  display: block;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.node-meta {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.type-badge {
  display: inline-block;
  background: #e8f5e9;
  color: #2e7d32;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.germplasm-badge {
  display: inline-block;
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

/* germplasm that comes down from the units above */
.inherited-germplasm-badge {
  display: inline-block;
  background: #f5f9fd;
  color: #5c8fc2;
  border: 1px dashed #90caf9;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.redacted-badge {
  display: inline-block;
  background: #ffebee;
  color: #c62828;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.count {
  font-size: 11px;
  color: #999;
}

.place-badge,
.ended-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.place-badge {
  background: #fff8e1;
  color: #8d6e00;
  text-decoration: none;
}

.place-badge:hover {
  text-decoration: underline;
}

.ended-badge {
  background: #f1f1f1;
  color: #666;
}

.away-link {
  align-self: flex-start;
  padding: 6px 10px;
  border: 1px dashed #bbb;
  border-radius: 4px;
  font-size: 12px;
  color: #1565c0;
  text-decoration: none;
}

.away-link:hover {
  background: #f5f9ff;
  border-color: #1565c0;
}

.children {
  margin-left: 28px;
  margin-top: 8px;
  padding-left: 8px;
  border-left: 2px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading,
.error {
  padding: 8px;
  font-size: 12px;
  color: #666;
}

.error {
  color: #d32f2f;
}
</style>