import { ref, computed, toValue } from 'vue';
import { useMutateDatasets } from '@/composables/datasets/mutateDatasets';
import { useDatetimeUtils } from '@/composables/parsers/partialDatetime';
import { useValueParser} from "@/composables/parsers/valueParser";
import { pollDatasetSubmission } from "@/composables/datasets/datasetSubmissionQuery";
import { useApolloClient } from '@vue/apollo-composable';

export function useDatasetTable({ selectedUnits, selectedConcepts, rowsPerUnit }) {

  const { resolveClient } = useApolloClient();

  const { submitCreateDataset } = useMutateDatasets();
  const { validatePartialDatetime, normalizePartialDatetime } = useDatetimeUtils();
  const { parseValue } = useValueParser();

  // Table data - each row has: unitId, unitLabel, startTime, endTime, and concept values
  const tableData = ref([]);

  // Column submission status tracking
  // { [conceptId]: { status: 'pending'|'submitting'|'success'|'error', datasetId?, error?, submissionId? } }
  const columnStatus = ref({});

  // Validation errors per cell
  // { [rowIndex-columnKey]: { message: string } }
  const cellErrors = ref({});

  // Active submission queries - keyed by conceptId
  // { [conceptId]: { submissionId, indexMapping, stopPolling } }
  const activeSubmissions = ref({});

  // Initialize table data based on units and rowsPerUnit
  const initializeTable = () => {
    const units = toValue(selectedUnits) || [];
    const rows = toValue(rowsPerUnit) || 1;

    const newData = [];
    units.forEach((unit) => {
      for (let i = 0; i < rows; i++) {
        const row = {
          _id: `${unit.id}-${i}-${Date.now()}`,
          unitId: unit.id,
          unitLabel: unit.name || unit.subject?.name || `Unit ${unit.id}`,
          startTime: '',
          endTime: '',
        };
        // Initialize concept columns with empty values
        (toValue(selectedConcepts) || []).forEach((concept) => {
          row[`concept_${concept.id}`] = '';
        });
        newData.push(row);
      }
    });

    tableData.value = newData;

    // Initialize column status
    const concepts = toValue(selectedConcepts) || [];
    const status = {};
    concepts.forEach((concept) => {
      status[concept.id] = { status: 'pending' };
    });
    columnStatus.value = status;
    cellErrors.value = {};
  };

  // Add a new row (duplicate of an existing row or blank)
  const addRow = (afterIndex, duplicateFrom = null) => {
    const concepts = toValue(selectedConcepts) || [];
    let newRow;

    if (duplicateFrom !== null && tableData.value[duplicateFrom]) {
      // Duplicate existing row
      newRow = { ...tableData.value[duplicateFrom], _id: `new-${Date.now()}` };
    } else {
      // Create blank row - need a unit
      const lastRow = tableData.value[afterIndex] || tableData.value[tableData.value.length - 1];
      newRow = {
        _id: `new-${Date.now()}`,
        unitId: lastRow?.unitId || null,
        unitLabel: lastRow?.unitLabel || '',
        startTime: '',
        endTime: '',
      };
      concepts.forEach((concept) => {
        newRow[`concept_${concept.id}`] = '';
      });
    }
    const insertAt = afterIndex !== undefined ? afterIndex + 1 : tableData.value.length;
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

    const concepts = toValue(selectedConcepts) || [];
    return concepts.some((concept) => row[`concept_${concept.id}`]);
  };

  // Get scale type for a concept
  const getScaleType = (concept) => {
    return concept?.scale?.scaleType || 'TEXT';
  };

  // Get categories for categorical concepts
  const getCategories = (concept) => {
    console.log('get categories for concept:', concept, concept?.scale?.categories)

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

    // Validate concept columns
    if (columnKey.startsWith('concept_')) {
      const conceptId = parseInt(columnKey.replace('concept_', ''));
      const concept = (toValue(selectedConcepts) || []).find(c => c.id === conceptId);
      if (!concept) return true;

      const categories = getCategories(concept);
      const result = parseValue(value, concept.scale, categories);

      if (result && typeof result === 'object' && result.error) {
        cellErrors.value[errorKey] = {
          message: result.error,
          // If it's a categorical mismatch, we might want it as a warning
          // instead of a hard error depending on UI preference
          isWarning: isCategoricalScale(concept)
        };
        return isCategoricalScale(concept); // Warnings return true for validation
      }
    }

    return true;
  };

  // Update cell value with validation
  const updateCell = (rowIndex, columnKey, value) => {
    if (tableData.value[rowIndex]) {
      tableData.value[rowIndex][columnKey] = value;

      validateCell(rowIndex, columnKey, value);
    }
  };

  // Bulk fill a column
  const bulkFillColumn = (columnKey, value) => {
    // Validate value first for datetime columns
    if ((columnKey === 'startTime' || columnKey === 'endTime') && value) {
      if (!validatePartialDatetime(value)) {
        return { success: false, message: 'Invalid datetime format' };
      }
    }

    tableData.value.forEach((row, index) => {
      // Skip if column is already submitted successfully
      if (columnKey.startsWith('concept_')) {
        const conceptId = parseInt(columnKey.replace('concept_', ''));
        if (columnStatus.value[conceptId]?.status === 'success') return;

        const concept = (toValue(selectedConcepts) || []).find(c => c.id === conceptId);
        if (concept && isComplexScale(concept)) return;
      }

      row[columnKey] = value;
      validateCell(index, columnKey, value);
    });

    return { success: true };
  };

  // Validate entire column before submission
  const validateColumn = (conceptId) => {
    const columnKey = `concept_${conceptId}`;
    let isValid = true;

    tableData.value.forEach((row, index) => {
      // Also validate datetime columns
      if (!validateCell(index, 'startTime', row.startTime)) isValid = false;
      if (!validateCell(index, 'endTime', row.endTime)) isValid = false;
      if (!validateCell(index, columnKey, row[columnKey])) isValid = false;
    });

    return isValid;
  };

  // Prepare records for submission (excludes empty values)
  const prepareRecords = (conceptId) => {
    const columnKey = `concept_${conceptId}`;
    const records = [];
    const indexMapping = []; // Track original indices for error mapping

    tableData.value.forEach((row, originalIndex) => {
      const value = row[columnKey];
      // Exclude empty string values
      if (value === '' || value === null || value === undefined) return;

      records.push({
        unitId: row.unitId,
        value: String(value),
        start: normalizePartialDatetime(row.startTime) || null,
        end: normalizePartialDatetime(row.endTime) || null,
      });
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

    const client = resolveClient();

    const onSubmissionComplete = ({ datasetId, status, errors, itemErrors}) => {
      if (status === 'COMPLETED') {
        columnStatus.value[conceptId] = {
          status: 'success',
          datasetId: datasetId,
          submissionId,
        };
      } else if (errors || itemErrors) {
        const mappedItemErrors = mapItemErrors(itemErrors, indexMapping);

        const columnKey = `concept_${conceptId}`;
        populateCellErrorsFromItemErrors(mappedItemErrors, columnKey);

        columnStatus.value[conceptId] = {
          status: 'error',
          error: errors || 'Submission failed',
          submissionId,
        };
      }
      stopPolling()
    }

    const { startPolling, stopPolling } = pollDatasetSubmission({
      client,
      submissionId: submissionId,
      onComplete: onSubmissionComplete
    })

    startPolling()
  };


  // Submit a single concept column
  const submitColumn = async (conceptId) => {
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
      const result = await submitCreateDataset({
        conceptId,
        records,
      });

      if (!result) {
        throw new Error('No response from server');
      }
      const submissionId = result.result;
      columnStatus.value[conceptId].submissionId = submissionId;

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
  const submitAllColumns = async () => {
    const concepts = toValue(selectedConcepts) || [];
    const pendingConcepts = concepts.filter(
      (c) => columnStatus.value[c.id]?.status !== 'success' && !isComplexScale(c)
    );

    const submissions = pendingConcepts.map((concept) => submitColumn(concept.id));
    await Promise.allSettled(submissions);
  };

    // Cleanup all active submissions (call when modal closes)
  const cleanupSubmissions = () => {
    Object.values(activeSubmissions.value).forEach(({ cleanup }) => {
      if (cleanup) cleanup();
    });
    activeSubmissions.value = {};
  };

  // Check if any column is currently submitting
  const isSubmitting = computed(() => {
    return Object.values(columnStatus.value).some((s) => s.status === 'submitting');
  });

  // Check if all columns are submitted successfully
  const allSubmitted = computed(() => {
    const concepts = toValue(selectedConcepts) || [];
    const nonComplexConcepts = concepts.filter((c) => !isComplexScale(c));
    return nonComplexConcepts.every(
      (c) => columnStatus.value[c.id]?.status === 'success'
    );
  });

  // Check if there are any unsaved changes
  const hasUnsavedChanges = computed(() => {
    if (allSubmitted.value) return false;
    return tableData.value.some((row) => rowHasData(tableData.value.indexOf(row)));
  });

  // Get cell error for display
  const getCellError = (rowIndex, columnKey) => {
    return cellErrors.value[`${rowIndex}-${columnKey}`];
  };

  // Check if column is disabled (submitted successfully or complex)
  const isColumnDisabled = (conceptId) => {
    const concept = (toValue(selectedConcepts) || []).find(c => c.id === conceptId);
    return columnStatus.value[conceptId]?.status === 'success' || isComplexScale(concept);
  };

  return {
    // Data
    tableData,
    columnStatus,
    cellErrors,

    // Methods
    initializeTable,
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

    // Computed
    isSubmitting,
    allSubmitted,
    hasUnsavedChanges,
  };
}