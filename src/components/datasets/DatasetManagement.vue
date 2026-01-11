
<script setup>
import { ref, computed } from "vue"
import { FormKit } from "@formkit/vue";
import { useSelectLocationsQuery } from "@/composables/datasets/selectLocationsQueries";
import { useSelectUnitsQuery } from "@/composables/datasets/selectUnitsQueries";
import { useSelectConceptsQuery } from "@/composables/datasets/selectConceptsQueries";
import DatasetTableModal from "./DatasetTableModal.vue";

const selectUnitData = ref({
  locationIds: [],
  unitIds: [],
  factorIds: [],
  variableIds: []
})

// Rows per unit for table generation
const rowsPerUnit = ref(1);

// Modal visibility
const showTableModal = ref(false);

const {
  regions,
  selectedLocations,
  loadDisplayedChildLocations,
  displayedLocationsLoading,
  displayedLocations
} = useSelectLocationsQuery({
  locationIds: () => selectUnitData.value?.locationIds
})

const {
  blocks,
  selectedUnits,
  loadDisplayedChildUnits,
  displayedUnitsLoading,
  displayedUnits
} = useSelectUnitsQuery({
  locationIds: () => selectUnitData.value?.locationIds,
  unitIds: () => selectUnitData.value?.unitIds
})

const {
  variables, variablesLoading,
  factors, factorsLoading
} = useSelectConceptsQuery()

// Create options arrays for the multiselects
const factorOptions = computed(() => {
  if (!factors.value) return []
  return factors.value.map(factor => ({
    label: factor.name || `Factor ${factor.id}`,
    value: factor.id
  }))
})

const variableOptions = computed(() => {
  if (!variables.value) return []
  return variables.value.map(variable => ({
    label: variable.name || `Variable ${variable.id}`,
    value: variable.id
  }))
})

// Combine selected factors and variables for the table
const selectedConcepts = computed(() => {
  const concepts = [];

  if (selectUnitData.value.factorIds && factors.value) {
    const selectedFactors = factors.value.filter(f =>
      selectUnitData.value.factorIds.includes(f.id)
    );
    concepts.push(...selectedFactors);
  }

  if (selectUnitData.value.variableIds && variables.value) {
    const selectedVariables = variables.value.filter(v =>
      selectUnitData.value.variableIds.includes(v.id)
    );
    concepts.push(...selectedVariables);
  }

  return concepts;
});

// Check if "Create Data Table" button should be enabled
const canCreateTable = computed(() => {
  return selectedUnits.value?.length > 0 && selectedConcepts.value?.length > 0;
});

// Open the table modal
const openTableModal = () => {
  showTableModal.value = true;
};

// Close the table modal
const closeTableModal = () => {
  showTableModal.value = false;
};

// Handle successful submission
const handleSubmitted = () => {
  // Optionally close modal or show success message
  // showTableModal.value = false;
};
</script>

<template>
  <div class="dataset-management">
    <h2>Dataset Management</h2>
    <FormKit
      v-model="selectUnitData"
      type="form"
      :actions="false"
      >
      <FormKit
        type="hierarchical-multiselect"
        name="locationIds"
        label="Locations:"
        help="Select locations"
        :value="selectUnitData.locationIds"
        :selected-nodes="selectedLocations"
        :rootNodes="regions"
        :loadChildrenFn="loadDisplayedChildLocations"
        :childrenLoading="displayedLocationsLoading"
        :currentChildren="displayedLocations"
        :get-node-label-fn="(u) => u.name || `${u.type?.name} ${u.id}`"
        :max-selections="5"
        validation="required"
      />

      <FormKit
        type="hierarchical-multiselect"
        name="unitIds"
        label="Units:"
        help="Select units from blocks at these locations"
        :value="selectUnitData.unitIds"
        :selected-nodes="selectedUnits"
        :rootNodes="blocks"
        :loadChildrenFn="loadDisplayedChildUnits"
        :childrenLoading="displayedUnitsLoading"
        :currentChildren="displayedUnits"
        :get-node-label-fn="(u) => u.name || `${u.subject?.name} ${u.id}`"
        :max-selections="100"
        validation="required"
      />

      <FormKit
        type="select"
        name="factorIds"
        label="Factors:"
        help="Select factors"
        :options="factorOptions"
        :disabled="factorsLoading"
        multiple
      />

      <FormKit
        type="select"
        name="variableIds"
        label="Variables:"
        help="Select variables"
        :options="variableOptions"
        :disabled="variablesLoading"
        multiple
      />

    </FormKit>

    <!-- Create Data Table Section -->
    <div class="table-section">
      <div class="table-controls">
        <div class="rows-input">
          <label for="rowsPerUnit">Rows per unit:</label>
          <input
            id="rowsPerUnit"
            v-model.number="rowsPerUnit"
            type="number"
            min="1"
            class="rows-number-input"
          />
        </div>

        <button
          class="create-table-btn"
          :disabled="!canCreateTable"
          @click="openTableModal"
        >
          Create Data Table
        </button>
      </div>

      <p v-if="!canCreateTable" class="help-text">
        Select at least one unit and one concept (factor or variable) to create a data table.
      </p>
    </div>

    <!-- Dataset Table Modal -->
    <DatasetTableModal
      :visible="showTableModal"
      :selected-units="selectedUnits"
      :selected-concepts="selectedConcepts"
      :rows-per-unit="rowsPerUnit"
      @close="closeTableModal"
      @submitted="handleSubmitted"
    />
  </div>
</template>

<style scoped>
.dataset-management {
  padding: 2rem;
}

.table-section {
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 2px solid #ddd;
}

.table-controls {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 12px;
}

.rows-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rows-input label {
  font-weight: 500;
  color: #333;
}

.rows-number-input {
  width: 80px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.create-table-btn {
  padding: 10px 20px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.create-table-btn:hover:not(:disabled) {
  background: #1976d2;
}

.create-table-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.help-text {
  color: #666;
  font-size: 14px;
  font-style: italic;
  margin: 0;
}
</style>