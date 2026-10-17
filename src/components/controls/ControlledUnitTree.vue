<!-- src/components/controls/ControlledUnitTree.vue: the units a team controls, as a tree from their unit graphs' roots -->
<script setup>
import { ref, computed, watch } from 'vue'

import BulkControlActions from './BulkControlActions.vue'
import {
  useControlledUnitTree, labelInfo, countOf, RELEASES, RELEASE_LABELS
} from '@/composables/controls/bulkControl'

const props = defineProps({
  team: { type: Object, required: true },
  // the release to act on, as chosen in the counts table; null for all
  release: { type: String, default: null }
})

const emit = defineEmits(['changed'])

const { nodes, childrenOf, expanded, hasBelow, toggle, reload, loading, error } = useControlledUnitTree(() => props.team.id)

const units = labelInfo('UNIT')
const releaseFilter = ref(props.release ?? '')
watch(() => [props.release, props.team.id], () => { releaseFilter.value = props.release ?? '' })

// The open tree as rows, depth first. A unit under several parents appears under each, so rows are keyed by path.
const rows = computed(() => {
  const list = []
  const walk = (parentId, depth, ancestors) => {
    for (const id of childrenOf.value[parentId] ?? []) {
      list.push({ key: [...ancestors, id].join('/'), id, node: nodes.value[id], depth, ancestors })
      if (expanded.value.has(id)) walk(id, depth + 1, [...ancestors, id])
    }
  }
  walk('', 0, [])
  return list
})

// Chosen units stand for themselves and everything below them that the team controls
const chosen = ref(new Set())
const everything = ref(false)
watch(() => props.team.id, () => {
  chosen.value = new Set()
  everything.value = false
})
const chosenAbove = (row) => row.ancestors.some((id) => chosen.value.has(id))
const toggleChosen = (row) => {
  const next = new Set(chosen.value)
  if (next.has(row.id)) next.delete(row.id)
  else {
    next.add(row.id)
    // units below a chosen one are included already
    rows.value.filter((r) => r.ancestors.includes(row.id)).forEach((r) => next.delete(r.id))
  }
  chosen.value = next
  everything.value = false
}
const chooseEverything = () => {
  chosen.value = new Set()
  everything.value = !everything.value
}

const totalControlled = computed(() =>
  (childrenOf.value[''] ?? []).reduce((n, id) => n + (nodes.value[id]?.count ?? 0), 0))
const atRelease = computed(() => (releaseFilter.value ? ` at ${RELEASE_LABELS[releaseFilter.value]}` : ''))
const releaseScope = computed(() => (releaseFilter.value ? { release: releaseFilter.value } : {}))

const selection = computed(() => {
  const scope = { teamId: String(props.team.id), label: 'UNIT', ...releaseScope.value }
  if (everything.value) return { scope }
  if (chosen.value.size === 0) return null
  return { scope: { ...scope, belowUnitIds: [...chosen.value] } }
})
const description = computed(() => {
  if (everything.value) return `all ${countOf(totalControlled.value, units)} ${props.team.name} controls${atRelease.value}`
  const ids = [...chosen.value]
  const count = ids.reduce((n, id) => n + (nodes.value[id]?.count ?? 0), 0)
  const what = ids.length === 1 ? (nodes.value[ids[0]]?.unit.name ?? 'a unit') : `${ids.length} units`
  return `${what} and below: ${countOf(count, units)} ${props.team.name} controls${atRelease.value}`
})

const changed = () => {
  chosen.value = new Set()
  everything.value = false
  reload()
  emit('changed')
}

const teamNames = (references) => references.map((r) => `${r.team.name}${r.standIn ? ' (a team within)' : ''}`).join(', ')
</script>

<template>
  <div class="controlled-unit-tree">
    <div class="list-header">
      <h4>Units {{ team.name }} controls</h4>
      <label>
        Act on
        <select v-model="releaseFilter" name="releaseFilter">
          <option value="">All releases</option>
          <option v-for="r in RELEASES" :key="r" :value="r">Only {{ RELEASE_LABELS[r] }}</option>
        </select>
      </label>
    </div>
    <p class="help-text">
      The unit graphs holding units {{ team.name }} controls, opened down to the topmost of them. Units it doesn't control
      are shown for context. Choosing a unit acts on it and everything below it that {{ team.name }} controls.
    </p>

    <BulkControlActions :selection="selection" :description="description" label="UNIT" :team="team" @changed="changed" />

    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="loading" class="text-muted">Loading units…</div>
    <template v-else>
      <label class="choose-everything">
        <input type="checkbox" :checked="everything" :disabled="!rows.length" @change="chooseEverything" />
        Everything: {{ countOf(totalControlled, units) }}
      </label>
      <ul class="unit-rows">
        <li
          v-for="row in rows"
          :key="row.key"
          class="unit-row"
          :class="{ controlled: !!row.node.release, chosen: everything || chosen.has(row.id) || chosenAbove(row) }"
          :style="{ paddingLeft: `${row.depth * 20 + 4}px` }"
          :data-unit-id="row.id"
        >
          <button
            v-if="hasBelow(row.id)"
            class="expander"
            :aria-label="expanded.has(row.id) ? 'Close' : 'Open'"
            @click="toggle(row.id)"
          >{{ expanded.has(row.id) ? '▼' : '►' }}</button>
          <span v-else class="expander-space"></span>
          <input
            type="checkbox"
            :checked="everything || chosen.has(row.id) || chosenAbove(row)"
            :disabled="everything || chosenAbove(row)"
            :aria-label="`Choose ${row.node.unit.name} and below`"
            @change="toggleChosen(row)"
          />
          <span class="unit-name">{{ row.node.unit.name }}</span>
          <span v-if="row.node.unit.subject" class="text-muted">{{ row.node.unit.subject.name }}</span>
          <template v-if="row.node.release">
            <span class="release-badge" :class="row.node.release">{{ RELEASE_LABELS[row.node.release] }}</span>
            <span v-if="row.node.otherTeams.length" class="text-muted">shared with {{ teamNames(row.node.otherTeams) }}</span>
          </template>
          <span v-else class="not-controlled">
            not controlled by {{ team.name }}<template v-if="row.node.otherTeams.length">: controlled by {{ teamNames(row.node.otherTeams) }}</template>
          </span>
          <span class="unit-count">{{ countOf(row.node.count, units) }}</span>
        </li>
        <li v-if="!rows.length" class="text-muted">{{ team.name }} controls no units.</li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.list-header h4 {
  margin: 0;
}

.help-text {
  margin: 6px 0 0;
  font-size: 0.85rem;
  color: #666;
}

.choose-everything {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-weight: 500;
}

.unit-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 520px;
  overflow-y: auto;
  border: 1px solid #e9ecef;
  border-radius: 6px;
}

.unit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid #f1f3f5;
  font-size: 0.9rem;
  color: #6c757d;
}

.unit-row.controlled {
  color: #212529;
}

.unit-row.chosen {
  background: #f1f8e9;
}

.expander,
.expander-space {
  width: 20px;
  flex: 0 0 20px;
}

.expander {
  border: none;
  background: none;
  padding: 0;
  color: #555;
  cursor: pointer;
}

.unit-name {
  font-weight: 500;
}

.not-controlled {
  font-style: italic;
  font-size: 0.8rem;
}

.unit-count {
  margin-left: auto;
  white-space: nowrap;
}

.release-badge {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 0.8rem;
  background: #eceff1;
}

.release-badge.PRIVATE { background: #fce4ec; color: #880e4f; }
.release-badge.REGISTERED { background: #fff3e0; color: #e65100; }
.release-badge.PUBLIC { background: #e8f5e9; color: #1b5e20; }

.error-message {
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
}
</style>
