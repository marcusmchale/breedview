<script setup>
import { computed, ref } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { studyName } from '@/composables/analysis/useAnalysisNames'
import IdListInput from '@/components/analysis/config/IdListInput.vue'
import UnitPicker from '@/components/analysis/config/UnitPicker.vue'
import GermplasmPicker from '@/components/analysis/config/GermplasmPicker.vue'
import PositionCriterionEditor from '@/components/analysis/config/PositionCriterionEditor.vue'
import RecordGroupMemberSelect from '@/components/analysis/config/RecordGroupMemberSelect.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const props = defineProps({
  index: { type: Number, required: true }
})

const emit = defineEmits(['remove'])

const { form, data, exclusionFeedback } = useAnalysisEditor()

const rule = computed(() => form.exclusions[props.index])
const path = computed(() => `exclusions.${props.index}`)
const feedback = computed(() => exclusionFeedback.value?.[props.index] ?? null)

const CRITERIA = {
  recordIds: 'Records',
  unitIds: 'Units',
  germplasmIds: 'Germplasm',
  studyIds: 'Studies',
  positions: 'Positions',
  recordGroups: 'Record groups',
  time: 'Time window'
}

const hasValue = (key) =>
  key === 'time' ? rule.value.start != null || rule.value.end != null : (rule.value[key] ?? []).length > 0

// Criteria shown in the editor: those with values, plus those added by the user
const opened = ref(new Set(Object.keys(CRITERIA).filter(hasValue)))
const shown = computed(() => Object.keys(CRITERIA).filter((k) => opened.value.has(k) || hasValue(k)))
const available = computed(() => Object.keys(CRITERIA).filter((k) => !shown.value.includes(k)))

const openCriterion = (key) => {
  if (!key) return
  opened.value = new Set([...opened.value, key])
  if (key === 'positions' && rule.value.positions.length === 0) addPosition()
  if (key === 'recordGroups' && rule.value.recordGroups.length === 0) addMember()
}

const closeCriterion = (key) => {
  if (key === 'time') {
    rule.value.start = null
    rule.value.end = null
  } else {
    rule.value[key] = []
  }
  const next = new Set(opened.value)
  next.delete(key)
  opened.value = next
}

const toggleStudy = (id) => {
  const ids = rule.value.studyIds
  rule.value.studyIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

const addPosition = () => rule.value.positions.push({ locationId: null, layoutId: null, axes: [] })
const addMember = () =>
  rule.value.recordGroups.push({ groupingId: data.groupings[0]?.id ?? null, code: '', datasetId: null })

const setTime = (key, value) => {
  rule.value[key] = value.trim() || null
}
</script>

<template>
  <div class="box rule">
    <div class="box-header">
      <h4>Rule {{ index + 1 }}</h4>
      <span
        v-if="feedback"
        class="feedback"
        :class="{ zero: feedback.count === 0 }"
        :title="feedback.message"
      >
        Last run: {{ feedback.count ?? '?' }} record{{ feedback.count === 1 ? '' : 's' }} excluded
        <template v-if="feedback.count === 0"> — check the criteria</template>
      </span>
      <button type="button" class="btn-link danger" @click="emit('remove')">Remove rule</button>
    </div>
    <FieldErrors :path="path" />
    <p v-if="shown.length === 0" class="hint">Add at least one criterion.</p>

    <div v-for="key in shown" :key="key" class="criterion">
      <div class="criterion-header">
        <span class="field-label">{{ CRITERIA[key] }}</span>
        <button type="button" class="btn-link danger" @click="closeCriterion(key)">×</button>
      </div>

      <IdListInput v-if="key === 'recordIds'" v-model="rule.recordIds" />

      <template v-else-if="key === 'unitIds'">
        <UnitPicker v-model="rule.unitIds" :block-ids="data.blockIds" />
        <p class="hint">Matches the record's base unit only, not its children.</p>
      </template>

      <template v-else-if="key === 'germplasmIds'">
        <GermplasmPicker v-model="rule.germplasmIds" />
        <p class="hint">Matches the germplasm of the base unit only, not its descendants.</p>
      </template>

      <div v-else-if="key === 'studyIds'" class="chip-list">
        <button
          v-for="id in [...new Set([...form.studyIds, ...rule.studyIds])]"
          :key="id"
          type="button"
          class="chip"
          :class="{ selected: rule.studyIds.includes(id) }"
          @click="toggleStudy(id)"
        >
          {{ studyName(id) }}
        </button>
      </div>

      <template v-else-if="key === 'positions'">
        <div v-for="(pos, i) in rule.positions" :key="i" class="list-item">
          <PositionCriterionEditor :model-value="pos" @update:model-value="rule.positions.splice(i, 1, $event)" />
          <button type="button" class="btn-link danger" @click="rule.positions.splice(i, 1)">Remove position</button>
        </div>
        <button type="button" class="btn-link" @click="addPosition">+ Add position</button>
        <p class="hint">Uses the unit's position history, not the record time.</p>
      </template>

      <template v-else-if="key === 'recordGroups'">
        <div v-for="(member, i) in rule.recordGroups" :key="i" class="list-item inline">
          <RecordGroupMemberSelect
            :model-value="member"
            :groupings="data.groupings"
            :codes-by-grouping="data.codesByGrouping"
            :dataset-ids="form.datasetIds"
            @update:model-value="rule.recordGroups.splice(i, 1, $event)"
          />
          <button type="button" class="btn-link danger" @click="rule.recordGroups.splice(i, 1)">×</button>
        </div>
        <button type="button" class="btn-link" :disabled="data.groupings.length === 0" @click="addMember">
          + Add code
        </button>
      </template>

      <template v-else-if="key === 'time'">
        <div class="field-row">
          <div class="field">
            <label>Start (inclusive)</label>
            <input
              type="text"
              :value="rule.start ?? ''"
              placeholder="Unbounded"
              @change="setTime('start', $event.target.value)"
            />
          </div>
          <div class="field">
            <label>End (exclusive)</label>
            <input type="text" :value="rule.end ?? ''" placeholder="Unbounded" @change="setTime('end', $event.target.value)" />
          </div>
        </div>
        <p class="hint">
          ISO 8601. A record matches when its start/end overlaps the window; records with no time never match. With
          positions, the window applies to the position history instead.
        </p>
      </template>

      <FieldErrors
        :path="key === 'time' ? `${path}.start` : `${path}.${key}`"
        :prefix="key !== 'time'"
      />
      <FieldErrors v-if="key === 'time'" :path="`${path}.end`" />
    </div>

    <select v-if="available.length" value="" class="add-criterion" @change="openCriterion($event.target.value); $event.target.value = ''">
      <option value="">+ Add criterion</option>
      <option v-for="key in available" :key="key" :value="key">{{ CRITERIA[key] }}</option>
    </select>
  </div>
</template>

<style scoped>
.rule {
  background: white;
}

.feedback {
  font-size: 0.8rem;
  color: var(--an-muted);
  margin-left: auto;
}

.feedback.zero {
  color: var(--an-warning);
  font-weight: 600;
}

.criterion {
  border-left: 3px solid var(--an-border);
  padding: 4px 10px 8px;
  margin-bottom: 8px;
}

.criterion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.list-item {
  padding: 6px 0;
  border-bottom: 1px dashed var(--an-border);
}

.list-item.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.add-criterion {
  margin-top: 4px;
}
</style>