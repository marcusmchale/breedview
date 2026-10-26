<!-- src/components/controls/BulkControlPanel.vue: what a team the user administers controls, and acting on many at once -->
<script setup>
import { ref, computed, watch } from 'vue'

import ControlledEntitiesList from './ControlledEntitiesList.vue'
import ControlledUnitTree from './ControlledUnitTree.vue'
import { useUserAccess } from '@/composables/user/useUserAccess'
import { useControlledCounts, CONTROLLED_LABELS, RELEASES, RELEASE_LABELS } from '@/composables/controls/bulkControl'

// Controls are an admin concern: the teams offered are those the user administers
const { adminTeams, loading: accessLoading } = useUserAccess()

const teamId = ref('')
watch(adminTeams, (teams) => {
  if (!teams.some((t) => String(t.id) === teamId.value)) teamId.value = teams.length ? String(teams[0].id) : ''
}, { immediate: true })
const team = computed(() => {
  const found = adminTeams.value.find((t) => String(t.id) === teamId.value)
  return found ? { id: String(found.id), name: found.fullname || found.name } : null
})

const { counts, countsLoading, countsError, refetchCounts } = useControlledCounts(() => (teamId.value ? [teamId.value] : []))

// One row per label the team controls anything of, with its counts by release
const rows = computed(() => CONTROLLED_LABELS
  .map((info) => {
    const byRelease = Object.fromEntries(RELEASES.map((r) => [r, 0]))
    counts.value.filter((c) => c.label === info.value).forEach((c) => { byRelease[c.release] += c.count })
    return { ...info, byRelease, total: RELEASES.reduce((n, r) => n + byRelease[r], 0) }
  })
  .filter((row) => row.total > 0))

// The label (and release) chosen in the table, listed below it
const label = ref(null)
const release = ref(null)
watch(teamId, () => {
  label.value = null
  release.value = null
})
const choose = (value, at = null) => {
  label.value = value
  release.value = at
}
</script>

<template>
  <div class="bulk-control-panel">
    <p class="intro text-muted">
      What a team you administer controls, by kind and release. Choose a kind to set the release of many records at
      once, offer them to another team, or end your team's control where other teams share it.
    </p>

    <div v-if="accessLoading && !adminTeams.length" class="text-muted">Loading your teams…</div>
    <p v-else-if="!adminTeams.length" class="text-muted no-teams">
      You administer no team. Controls are set by the admins of the teams that control records.
    </p>
    <template v-else>
      <label class="team-picker">
        Team
        <select v-model="teamId" name="bulkTeam">
          <option v-for="t in adminTeams" :key="t.id" :value="String(t.id)">{{ t.fullname || t.name }}</option>
        </select>
      </label>

      <div v-if="countsError" class="error-message">{{ countsError }}</div>
      <div v-else-if="countsLoading && !counts.length" class="text-muted">Counting…</div>
      <p v-else-if="!rows.length" class="text-muted">{{ team?.name }} controls nothing.</p>
      <table v-else class="counts-table">
        <thead>
          <tr>
            <th>Kind</th>
            <th v-for="r in RELEASES" :key="r">{{ RELEASE_LABELS[r] }}</th>
            <th>All</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.value" :class="{ active: label === row.value }" :data-label="row.value">
            <th><button class="link-button" @click="choose(row.value)">{{ row.plural }}</button></th>
            <td v-for="r in RELEASES" :key="r" :class="{ active: label === row.value && release === r }">
              <button v-if="row.byRelease[r]" class="link-button count" @click="choose(row.value, r)">
                {{ row.byRelease[r].toLocaleString() }}
              </button>
              <span v-else class="text-muted">–</span>
            </td>
            <td><button class="link-button count" @click="choose(row.value)">{{ row.total.toLocaleString() }}</button></td>
          </tr>
        </tbody>
      </table>

      <ControlledUnitTree
        v-if="team && label === 'UNIT'"
        :team="team"
        :release="release"
        @changed="refetchCounts()"
      />
      <ControlledEntitiesList
        v-else-if="team && label"
        :team="team"
        :label="label"
        :release="release"
        @changed="refetchCounts()"
      />
    </template>
  </div>
</template>

<style scoped>
.intro {
  margin: 0 0 16px;
}

.team-picker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-weight: 500;
}

.counts-table {
  border-collapse: collapse;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.counts-table th,
.counts-table td {
  padding: 6px 14px;
  border-bottom: 1px solid #e9ecef;
  text-align: right;
}

.counts-table th:first-child {
  text-align: left;
}

.counts-table tr.active th,
.counts-table td.active {
  background: #f1f8e9;
}

.link-button {
  border: none;
  background: none;
  padding: 0;
  color: var(--brand-accent-dark);
  cursor: pointer;
  font: inherit;
}

.link-button:hover {
  text-decoration: underline;
}

.error-message {
  padding: 8px 12px;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  color: #721c24;
}
</style>
