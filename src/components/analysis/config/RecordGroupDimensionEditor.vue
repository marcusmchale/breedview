<script setup>
import { computed, ref, watch } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { renameDimensionReferences } from '@/composables/analysis/useAnalysisForm'
import { datasetName, groupingName, studyName } from '@/composables/analysis/useAnalysisNames'
import { RECORD_GROUP_EXTENT_DESCRIPTIONS, extentLabel } from '@/composables/ontology/recordGroupExtent'
import RecordGroupMemberSelect from '@/components/analysis/config/RecordGroupMemberSelect.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const props = defineProps({
  index: { type: Number, required: true }
})

const emit = defineEmits(['remove'])

const { form, data } = useAnalysisEditor()

const dimension = computed(() => form.grouping.recordGroups[props.index])
const path = computed(() => `grouping.recordGroups.${props.index}`)

/* ---------- name ---------- */

const nameDraft = ref(dimension.value.name)
watch(() => dimension.value?.name, (name) => (nameDraft.value = name ?? ''))

const nameProblem = computed(() => {
  const name = nameDraft.value.trim()
  if (!name) return 'A name is required.'
  if (name.includes('|')) return 'The name must not contain "|".'
  if (form.grouping.recordGroups.some((d, i) => i !== props.index && d.name === name)) return 'Names must be unique.'
  return null
})

const commitName = () => {
  const name = nameDraft.value.trim()
  if (nameProblem.value || name === dimension.value.name) return
  renameDimensionReferences(form, dimension.value.name, name)
  dimension.value.name = name
}

/* ---------- groupings ---------- */

const groupingsByStudy = computed(() => {
  const out = {}
  for (const g of data.groupings) (out[g.studyId] ??= []).push(g)
  return out
})

const usedElsewhere = computed(
  () => new Set(form.grouping.recordGroups.filter((_, i) => i !== props.index).flatMap((d) => d.groupingIds))
)

const isSelected = (id) => dimension.value.groupingIds.includes(id)

// At most one grouping per study, and a grouping belongs to only one dimension
const isDisabled = (g) => {
  if (isSelected(g.id)) return false
  if (usedElsewhere.value.has(g.id)) return true
  return dimension.value.groupingIds.some((id) => data.groupingsById[id]?.studyId === g.studyId)
}

const disabledReason = (g) => {
  if (usedElsewhere.value.has(g.id)) return 'Used by another dimension'
  if (isDisabled(g)) return 'Another grouping of this study is selected'
  return ''
}

const toggleGrouping = (g) => {
  const d = dimension.value
  if (isSelected(g.id)) {
    d.groupingIds = d.groupingIds.filter((id) => id !== g.id)
    d.levels.forEach((l) => (l.members = l.members.filter((m) => m.groupingId !== g.id)))
  } else {
    d.groupingIds = [...d.groupingIds, g.id]
    // WITHIN_UNIT codes can't be members of shared levels
    if (g.extent === 'WITHIN_UNIT') {
      d.levels.forEach((l) => (l.members = l.members.filter((m) => m.groupingId !== g.id)))
    }
  }
}

// Groupings selected in the dimension that aren't in the selected studies (e.g. from a loaded analysis)
const unknownGroupingIds = computed(() => dimension.value.groupingIds.filter((id) => !data.groupingsById[id]))

const selectedGroupings = computed(() =>
  dimension.value.groupingIds.map((id) => data.groupingsById[id]).filter(Boolean)
)

const withinUnitSelected = computed(() => selectedGroupings.value.some((g) => g.extent === 'WITHIN_UNIT'))

/* ---------- shared levels ---------- */

// Only codes of SHARED groupings can be merged into shared levels
const sharedGroupings = computed(() => selectedGroupings.value.filter((g) => g.extent !== 'WITHIN_UNIT'))
const showSharedLevels = computed(
  () => sharedGroupings.value.length > 0 || selectedGroupings.value.length === 0 || dimension.value.levels.length > 0
)

const addLevel = () => dimension.value.levels.push({ label: '', members: [] })
const removeLevel = (i) => dimension.value.levels.splice(i, 1)
const addMember = (level) => level.members.push({ groupingId: sharedGroupings.value[0]?.id ?? null, code: '', datasetId: null })
const setMember = (level, i, value) => level.members.splice(i, 1, value)
const removeMember = (level, i) => level.members.splice(i, 1)
</script>

<template>
  <div class="box">
    <div class="box-header">
      <div class="field name-field">
        <label>Dimension name</label>
        <input v-model="nameDraft" type="text" placeholder="e.g. Replicate" @change="commitName" @blur="commitName" />
        <span v-if="nameProblem" class="hint error-text">{{ nameProblem }}</span>
        <FieldErrors :path="`${path}.name`" />
      </div>
      <button type="button" class="btn-link danger" @click="emit('remove')">Remove dimension</button>
    </div>

    <div class="field">
      <span class="field-label">Record groupings</span>
      <p v-if="data.groupings.length === 0" class="hint">
        No record groupings are defined for the studies of the selected datasets.
      </p>
      <div v-for="(list, studyId) in groupingsByStudy" :key="studyId" class="study-groupings">
        <span class="muted">{{ studyName(studyId) }}</span>
        <label v-for="g in list" :key="g.id" class="grouping-option" :title="disabledReason(g)">
          <input type="checkbox" :checked="isSelected(g.id)" :disabled="isDisabled(g)" @change="toggleGrouping(g)" />
          {{ g.name }}
          <span class="muted">{{ g.type?.name }} · {{ g.scope === 'DATASET_SCOPED' ? 'dataset-scoped' : 'study-wide' }}</span>
          <span
            class="extent-badge"
            :class="{ 'within-unit': g.extent === 'WITHIN_UNIT' }"
            :title="RECORD_GROUP_EXTENT_DESCRIPTIONS[g.extent]"
          >
            {{ extentLabel(g.extent).toLowerCase() }}
          </span>
        </label>
      </div>
      <p v-for="id in unknownGroupingIds" :key="id" class="hint">
        {{ groupingName(id) }} (from the loaded analysis; select its study to edit it)
      </p>
      <p v-if="withinUnitSelected" class="hint replicate-note">
        Within-unit groupings hold replicates: this dimension keeps each replicate as its own observation, which suits
        descriptive statistics, outlier detection, correlation and MDS of individual readings. It can't be used as a term
        or in ANOVA. To count each unit once, set a replicate aggregation on the concept terms instead.
      </p>
      <FieldErrors :path="`${path}.groupingIds`" prefix />
    </div>

    <div v-if="showSharedLevels" class="field">
      <span class="field-label">Shared levels</span>
      <p class="hint">
        By default, levels are nested: equal codes in different groupings or scopes are different levels. A shared level
        merges exactly the codes it lists, e.g. a processing batch spanning studies.
      </p>
      <div v-for="(level, li) in dimension.levels" :key="li" class="level">
        <div class="level-header">
          <input v-model="level.label" type="text" placeholder="Level label" />
          <button type="button" class="btn-link danger" @click="removeLevel(li)">Remove level</button>
        </div>
        <div v-for="(member, mi) in level.members" :key="mi" class="member-row">
          <RecordGroupMemberSelect
            :model-value="member"
            :groupings="sharedGroupings"
            :codes-by-grouping="data.codesByGrouping"
            :dataset-ids="form.datasetIds"
            @update:model-value="setMember(level, mi, $event)"
          />
          <span v-if="member.datasetId" class="muted">{{ datasetName(member.datasetId) }}</span>
          <button type="button" class="btn-link danger" @click="removeMember(level, mi)">×</button>
        </div>
        <button type="button" class="btn-link" :disabled="sharedGroupings.length === 0" @click="addMember(level)">
          + Add code
        </button>
        <FieldErrors :path="`${path}.levels.${li}`" prefix />
      </div>
      <p v-if="withinUnitSelected && sharedGroupings.length" class="hint">Codes of within-unit groupings can't be shared.</p>
      <button type="button" class="btn-link" @click="addLevel">+ Add shared level</button>
    </div>
  </div>
</template>

<style scoped>
.name-field {
  flex: 1;
  max-width: 320px;
  margin-bottom: 0;
}

.error-text {
  color: var(--an-error);
}

.study-groupings {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}

.grouping-option {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
}

.extent-badge {
  font-size: 0.7rem;
  padding: 0 6px;
  border-radius: 8px;
  background: #eceff1;
  color: #455a64;
}

.extent-badge.within-unit {
  background: #f3e5f5;
  color: #6a1b9a;
}

.replicate-note {
  margin-top: 6px;
}

.level {
  border-left: 3px solid var(--an-border);
  padding: 6px 10px;
  margin-bottom: 8px;
  background: white;
}

.level-header,
.member-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
</style>
