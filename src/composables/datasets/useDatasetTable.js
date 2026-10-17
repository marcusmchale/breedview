import { ref, computed, toValue } from 'vue';
import { useMutateDatasets } from '@/composables/datasets/mutateDatasets';
import { useDatasetSummariesQuery } from "@/composables/datasets/datasetSummariesQuery";
import { useDatetimeUtils } from '@/composables/parsers/partialDatetime';
import { useValueParser } from "@/composables/parsers/valueParser";
import { pollDatasetSubmission } from "@/composables/datasets/datasetSubmissionQuery";
import { useApolloClient } from '@vue/apollo-composable';

export function useDatasetTable({
  selectedStudy,
  selectedUnits,
  selectedConcepts,
  rowsPerUnit,
  selectedGroupings = () => [],
}) {

  const { resolveClient } = useApolloClient();

  const { createDataset } = useMutateDatasets();
  const { refetchSummaries } = useDatasetSummariesQuery(() => toValue(selectedStudy)?.id);
  const { validatePartialDatetime, normalizePartialDatetime } = useDatetimeUtils();
  const { parseValue } = useValueParser();

  // Table data - each row has: unitId, unitLabel, startTime, endTime, grouping values and concept values
  const tableData = ref([]);

  // Column submission status tracking
  // { [conceptId]: { status: 'pending'|'submitting'|'success'|'error', datasetId?, error?, submissionId? } }
  const columnStatus = ref({});

  // Validation errors per cell
  // { [rowIndex-columnKey]: { message: string } }
  const cellErrors = ref({});

  // Active submission polling - keyed by conceptId
  // { [conceptId]: { submissionId, stopPolling } }
  const activeSubmissions = ref({});

// Set when a submission completes; cleared once summaries are refreshed
  let completedSinceRefresh = false;

  const refreshStudySummaries = async () => {
    try {
      await refetchSummaries();
    } catch (error) {
      console.error('Failed to refresh dataset summaries:', error);
    }
  };

  // ---- Concept helpers ----
  const getConcepts = () => toValue(selectedConcepts) || [];

  // Compare as strings so numeric and string IDs both work
  const findConcept = (conceptId) =>
    getConcepts().find((c) => String(c.id) === String(conceptId));

  const conceptIdFromKey = (columnKey) => columnKey.replace('concept_', '');


  // ---- Record grouping helpers ----
  const groupingKey = (groupingId) => `group_${groupingId}`;
  const isGroupingKey = (columnKey) => typeof columnKey === 'string' && columnKey.startsWith('group_');
  const getGroupings = () => toValue(selectedGroupings) || [];
  const normalizeCode = (value) => String(value ?? '').trim();

  // Once any column is submitted (or submitting), grouping values must not change,
  // otherwise datasets from the same table would carry inconsistent group codes.
  const isGroupingLocked = computed(() =>
    Object.values(columnStatus.value).some(
      (s) => s.status === 'submitting' || (s.status === 'success' && s.datasetId)
    )
  );

  // Build RecordGroupInput list for a row: [{ id: groupingId, code }]
  const buildRecordGroups = (row) =>
    getGroupings()
      .map((grouping) => ({ id: grouping.id, code: normalizeCode(row[groupingKey(grouping.id)]) }))
      .filter((group) => group.code);

  // Distinct values already entered for a grouping (used for dropdown suggestions)
  const getGroupingValueOptions = (groupingId) => {
    const key = groupingKey(groupingId);
    return [...new Set(tableData.value.map((row) => normalizeCode(row[key])).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  };

  // Rows split by the combination of DATASET_SCOPED grouping values
  const rowSplitGroups = computed(() => {
    const scoped = getGroupings().filter((g) => g.scope === 'DATASET_SCOPED');
    if (scoped.length === 0) return [];

    const groups = new Map();
    tableData.value.forEach((row, index) => {
      const values = scoped.map((g) => normalizeCode(row[groupingKey(g.id)]));
      const unassigned = values.some((v) => !v);
      const key = unassigned ? '__unassigned__' : values.join('\u0000');
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          unassigned,
          label: unassigned ? '(unassigned)' : values.join(' / '),
          rowIndices: [],
        });
      }
      groups.get(key).rowIndices.push(index);
    });
    return [...groups.values()];
  });


  // Helper to determine coordinate columns from all selected units
  const determineCoordinateColumns = () => {
    const units = toValue(selectedUnits) || [];

    // Map of axis index to Set of unique axis names
    const axisNamesMap = new Map();
    let maxAxisCount = 0;

    units.forEach(unit => {
      const pos = unit.positions?.[0];
      const axes = pos?.layout?.axes || [];

      maxAxisCount = Math.max(maxAxisCount, axes.length);

      // Collect unique names for each axis position
      axes.forEach((axisName, index) => {
        if (!axisNamesMap.has(index)) {
          axisNamesMap.set(index, new Set());
        }
        axisNamesMap.get(index).add(axisName);
      });
    });

    // Generate column definitions from the collected axis names
    const columns = [];
    for (let i = 0; i < maxAxisCount; i++) {
      const axisNames = axisNamesMap.get(i) || new Set();
      const header = Array.from(axisNames).sort().join(':');

      columns.push({
        key: `coord_${i}`,
        header: header || `axis_${i}`, // fallback if no names found
        axisIndex: i,
      });
    }

    return columns;
  };

  // Initialize table data based on units and rowsPerUnit
  const initializeTable = () => {
    cleanupSubmissions();

    const units = toValue(selectedUnits) || [];
    const rows = toValue(rowsPerUnit) || 1;
    const concepts = getConcepts();
    const groupings = getGroupings();

    // Determine coordinate columns once for ALL units
    const coordColumns = determineCoordinateColumns();

    const newData = [];
    units.forEach((unit) => {
      // Get latest position if available
      const pos = unit.positions?.[0];

      for (let i = 0; i < rows; i++) {
        const row = {
          _id: `${unit.id}-${i}-${Date.now()}`,
          unitId: unit.id,
          unitLabel: unit.name || unit.subject?.name || `Unit ${unit.id}`,
          germplasmName: unit.germplasm?.name || '',
          germplasmId: unit.germplasm?.id || '',
          locationName: pos?.location?.name || '',
          locationId: pos?.location?.id || '',
          layoutName: pos?.layout?.name || '',
          startTime: '',
          endTime: '',
        };

        // Create coordinate columns using pre-computed column info
        coordColumns.forEach(col => {
          row[col.key] = pos?.coordinates?.[col.axisIndex] || '';
        });

        // Initialize grouping columns (shared per row, like start/end)
        groupings.forEach((grouping) => {
          row[groupingKey(grouping.id)] = '';
        });

        // Initialize concept columns with empty values
        concepts.forEach((concept) => {
          row[`concept_${concept.id}`] = '';
        });

        newData.push(row);
      }
    });

    tableData.value = newData;

    // Initialize column status
    const status = {};
    concepts.forEach((concept) => {
      status[concept.id] = { status: 'pending' };
    });
    columnStatus.value = status;
    cellErrors.value = {};
  };

  // Duplicate an existing row (also the way to split a unit across grouping values)
  const addRow = (afterIndex, sourceIndex) => {
    if (!tableData.value[sourceIndex]) return;

    // Duplicate the source row with all its data including coordinate and grouping columns
    const newRow = { ...tableData.value[sourceIndex], _id: `new-${Date.now()}` };

    const insertAt = afterIndex + 1;
    tableData.value = [
      ...tableData.value.slice(0, insertAt),
      newRow,
      ...tableData.value.slice(insertAt)
    ];
  };

  // Remove a row
  const removeRow = (index) => {
    tableData.value = [
      ...tableData.value.slice(0, index),
      ...tableData.value.slice(index + 1)
    ];
  };

  // Check if row has any data entered
  const rowHasData = (index) => {
    const row = tableData.value[index];
    if (!row) return false;

    if (row.startTime || row.endTime) return true;

    if (getGroupings().some((g) => normalizeCode(row[groupingKey(g.id)]))) return true;

    return getConcepts().some((concept) => row[`concept_${concept.id}`]);
  };

  // Get scale type for a concept
  const getScaleType = (concept) => {
    return concept?.scale?.scaleType || 'TEXT';
  };

  // Get categories for categorical concepts
  const getCategories = (concept) => {
    return concept?.scale?.categories || [];
  };

  // Check if scale type is complex (requires file upload)
  const isComplexScale = (concept) => {
    return getScaleType(concept) === 'COMPLEX';
  };

  // Check if scale is categorical (ordinal or nominal)
  const isCategoricalScale = (concept) => {
    const scaleType = getScaleType(concept);
    return scaleType === 'ORDINAL' || scaleType === 'NOMINAL';
  };

  // Check if scale is numeric
  const isNumericScale = (concept) => {
    const scaleType = getScaleType(concept);
    return scaleType === 'NUMERICAL' || scaleType === 'DATE' || scaleType === 'DURATION';
  };

  // Validate a single cell value
  const validateCell = (rowIndex, columnKey, value) => {
    const errorKey = `${rowIndex}-${columnKey}`;
    // Clear existing error
    delete cellErrors.value[errorKey];
    if (!value || value === '') return true;

    // Validate datetime columns
    if (columnKey === 'startTime' || columnKey === 'endTime') {
      if (!validatePartialDatetime(value)) {
        cellErrors.value[errorKey] = {
          message: 'Invalid datetime format. Use: YYYY, YYYY-MM, YYYY-MM-DD, or YYYY-MM-DDTHH:MM'
        };
        return false;
      }
      return true;
    }

    // Grouping columns: free-text codes, only presence is validated (in validateColumn)
    if (isGroupingKey(columnKey)) {
      return true;
    }

    // Validate concept columns
    if (columnKey.startsWith('concept_')) {
      const concept = findConcept(conceptIdFromKey(columnKey));
      if (!concept) return true;

      const categories = getCategories(concept);
      const result = parseValue(value, concept.scale, categories);

      if (result && typeof result === 'object' && result.error) {
        cellErrors.value[errorKey] = {
          message: result.error,
          // Categorical mismatches are shown as warnings rather than hard errors
          isWarning: isCategoricalScale(concept)
        };
        return isCategoricalScale(concept); // Warnings return true for validation
      }
    }
    return true;
  };

  // Update cell value with validation
  const updateCell = (rowIndex, columnKey, value) => {
    if (isGroupingKey(columnKey) && isGroupingLocked.value) return;

    if (tableData.value[rowIndex]) {
      // Create a new array with the updated row to trigger reactivity
      tableData.value = tableData.value.map((row, idx) =>
        idx === rowIndex
          ? { ...row, [columnKey]: value }
          : row
      );

      validateCell(rowIndex, columnKey, value);
    }
  };

  // Bulk fill a column
  const bulkFillColumn = (columnKey, value) => {
    if (isGroupingKey(columnKey) && isGroupingLocked.value) {
      return { success: false, message: 'Grouping values are locked after submission' };
    }

    // Validate value first for datetime columns
    if ((columnKey === 'startTime' || columnKey === 'endTime') && value) {
      if (!validatePartialDatetime(value)) {
        return { success: false, message: 'Invalid datetime format' };
      }
    }

    // Create a new array to ensure Vue reactivity detects the change
    tableData.value = tableData.value.map((row, index) => {
      if (columnKey.startsWith('concept_')) {
        const conceptId = conceptIdFromKey(columnKey);
        // Skip if column is already submitted successfully
        if (columnStatus.value[conceptId]?.status === 'success') return row;

        const concept = findConcept(conceptId);
        if (concept && isComplexScale(concept)) return row;
      }

      // Create a new row object to trigger reactivity
      const newRow = { ...row, [columnKey]: value };
      validateCell(index, columnKey, value);
      return newRow;
    });

    return { success: true };
  };

  // Validate entire column before submission
  const validateColumn = (conceptId) => {
    const columnKey = `concept_${conceptId}`;
    const groupings = getGroupings();
    let isValid = true;

    tableData.value.forEach((row, index) => {
      // Also validate datetime columns
      if (!validateCell(index, 'startTime', row.startTime)) isValid = false;
      if (!validateCell(index, 'endTime', row.endTime)) isValid = false;
      if (!validateCell(index, columnKey, row[columnKey])) isValid = false;

      // Every row producing a record needs a value for each included grouping
      const value = row[columnKey];
      if (value !== '' && value !== null && value !== undefined) {
        groupings.forEach((grouping) => {
          const key = groupingKey(grouping.id);
          if (!normalizeCode(row[key])) {
            cellErrors.value[`${index}-${key}`] = {
              message: `${grouping.name} is required for rows with values`
            };
            isValid = false;
          }
        });
      }
    });

    return isValid;
  };

  // Prepare records for submission (excludes empty values)
  const prepareRecords = (conceptId) => {
    const columnKey = `concept_${conceptId}`;
    const concept = findConcept(conceptId);
    const records = [];
    const indexMapping = []; // Track original indices for error mapping

    tableData.value.forEach((row, originalIndex) => {
      const value = row[columnKey];
      // Exclude empty string values
      if (value === '' || value === null || value === undefined) return;

      const record = {
        unitId: row.unitId,
        start: normalizePartialDatetime(row.startTime) || null,
        end: normalizePartialDatetime(row.endTime) || null,
      };

      const groups = buildRecordGroups(row);
      if (groups.length > 0) {
        record.groups = groups;
      }

      // For complex scales, extract referenceIds from the JSON array
      if (isComplexScale(concept)) {
        try {
          const references = JSON.parse(value);
          if (Array.isArray(references) && references.length > 0) {
            record.referenceIds = references.map(reference => reference.id);
            record.value = null; // Complex scales don't use value field, only references
          } else {
            return; // Skip if no references
          }
        } catch {
          return; // Skip invalid JSON
        }
      } else {
        record.value = String(value);
      }

      records.push(record);
      indexMapping.push(originalIndex);
    });

    return { records, indexMapping };
  };

  // Map item errors back to original row indices
  const mapItemErrors = (itemErrors, indexMapping) => {
    if (!itemErrors || !indexMapping) return [];

    return itemErrors.map(err => ({
      originalIndex: indexMapping[err.index],
      error: err.error,
    }));
  };

  // Populate cellErrors from item errors
  const populateCellErrorsFromItemErrors = (itemErrors, columnKey) => {
    if (!itemErrors || itemErrors.length === 0) return;

    itemErrors.forEach((itemError) => {
      const errorKey = `${itemError.originalIndex}-${columnKey}`;
      cellErrors.value[errorKey] = {
        message: itemError.error,
        isWarning: false,
        isServerError: true
      };
    });
  };

  // Start polling for a submission
  const startSubmissionPolling = (conceptId, submissionId, indexMapping) => {
    console.debug('start submission polling', conceptId, submissionId);
    const client = resolveClient();

    const onSubmissionComplete = ({ datasetId, status, errors, itemErrors }) => {
      if (status === 'COMPLETED') {
        completedSinceRefresh = true;
        columnStatus.value[conceptId] = {
          status: 'success',
          datasetId: datasetId,
          submissionId,
        };
      } else if (status === 'FAILED' || errors || itemErrors) {
        const mappedItemErrors = mapItemErrors(itemErrors, indexMapping);

        const columnKey = `concept_${conceptId}`;
        populateCellErrorsFromItemErrors(mappedItemErrors, columnKey);

        columnStatus.value[conceptId] = {
          status: 'error',
          error: errors || 'Submission failed',
          submissionId,
        };
      }
      stopPolling();
      delete activeSubmissions.value[conceptId];


      // Refresh once all in-flight submissions are done (avoids one refetch per column)
      if (Object.keys(activeSubmissions.value).length === 0 && completedSinceRefresh) {
        completedSinceRefresh = false;
        refreshStudySummaries();
      }

    };

    const { startPolling, stopPolling } = pollDatasetSubmission({
      client,
      submissionId: submissionId,
      onComplete: onSubmissionComplete
    });

    activeSubmissions.value[conceptId] = { submissionId, stopPolling };
    startPolling();
  };

  // Submit a single concept column
  const submitColumn = async (conceptId, controlTeamId, release, contributions = []) => {
    // Skip if already submitted
    if (columnStatus.value[conceptId]?.status === 'success') return;

    // Validate first
    if (!validateColumn(conceptId)) {
      columnStatus.value[conceptId] = {
        status: 'error',
        error: 'Validation failed. Please fix errors before submitting.',
      };
      return;
    }

    const { records, indexMapping } = prepareRecords(conceptId);

    // Skip if no records
    if (records.length === 0) {
      columnStatus.value[conceptId] = {
        status: 'success',
        datasetId: null,
        message: 'No records to submit',
      };
      return;
    }

    columnStatus.value[conceptId] = { status: 'submitting' };

    try {
      console.debug('submitting dataset', toValue(selectedStudy), conceptId);
      const dataset = {
        studyId: toValue(selectedStudy).id,
        conceptId: conceptId,
        records: records,
      };
      // [{ personId, roleIds }]
      const credited = toValue(contributions) ?? [];
      if (credited.length > 0) {
        dataset.contributions = credited.map(({ personId, roleIds }) => ({ personId, roleIds: [...(roleIds ?? [])] }));
      }
      const result = await createDataset({
        dataset,
        controlTeamId: controlTeamId,
        release: release
      });

      if (!result) {
        throw new Error('No response from server');
      }
      if (result.status && result.status !== 'SUCCESS' && !result.result) {
        throw new Error(result.errors?.map((e) => e.message).join('; ') || 'Submission failed');
      }

      const submissionId = result.result;
      columnStatus.value[conceptId] = { status: 'submitting', submissionId };

      // Start polling using the query
      startSubmissionPolling(conceptId, submissionId, indexMapping);

    } catch (error) {
      columnStatus.value[conceptId] = {
        status: 'error',
        error: error.message || 'Submission failed',
      };
    }
  };

  // Submit all columns in parallel
  const submitAllColumns = async (controlTeamId, release, contributions = []) => {
    const pendingConcepts = getConcepts().filter(
      (c) => columnStatus.value[c.id]?.status !== 'success'
    );

    const submissions = pendingConcepts.map((concept) => submitColumn(concept.id, controlTeamId, release, contributions));
    await Promise.allSettled(submissions);
  };

  // Cleanup all active submissions (call when modal closes)
  const cleanupSubmissions = () => {
    Object.values(activeSubmissions.value).forEach(({ stopPolling }) => {
      if (stopPolling) stopPolling();
    });
    activeSubmissions.value = {};
  };

  // Check if any column is currently submitting
  const isSubmitting = computed(() => {
    return Object.values(columnStatus.value).some((s) => s.status === 'submitting');
  });

  // Check if all columns are submitted successfully
  const allSubmitted = computed(() => {
    const concepts = getConcepts();
    if (concepts.length === 0) return false;
    return concepts.every(
      (c) => columnStatus.value[c.id]?.status === 'success'
    );
  });

  // Check if there are any unsaved changes
  const hasUnsavedChanges = computed(() => {
    if (allSubmitted.value) return false;
    return tableData.value.some((_, index) => rowHasData(index));
  });

  // Get cell error for display
  const getCellError = (rowIndex, columnKey) => {
    return cellErrors.value[`${rowIndex}-${columnKey}`];
  };

  // Check if column is disabled (submitted successfully)
  const isColumnDisabled = (conceptId) => {
    return columnStatus.value[conceptId]?.status === 'success';
  };

  return {
    // Data
    tableData,
    columnStatus,
    cellErrors,

    // Methods
    initializeTable,
    determineCoordinateColumns,
    addRow,
    removeRow,
    rowHasData,
    updateCell,
    bulkFillColumn,
    validateCell,
    validateColumn,
    submitColumn,
    submitAllColumns,
    cleanupSubmissions,

    // Helpers
    getScaleType,
    getCategories,
    isComplexScale,
    isCategoricalScale,
    isNumericScale,
    getCellError,
    isColumnDisabled,

    // Grouping
    groupingKey,
    isGroupingLocked,
    getGroupingValueOptions,
    rowSplitGroups,
    buildRecordGroups,

    // Computed
    isSubmitting,
    allSubmitted,
    hasUnsavedChanges,
  };
}