import { ref, computed, toValue } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { useMutateDatasets } from './mutateDatasets'
import { useDatetimeUtils } from '@/composables/parsers/partialDatetime'
import { useValueParser } from '@/composables/parsers/valueParser'
import { pollDatasetSubmission } from "@/composables/datasets/datasetSubmissionQuery";
import { useCacheUpdates } from "@/composables/system/cacheUpdates";

import CONTROLLERS_QUERY from '@/graphql/controls/controllers.graphql'
import RECORD_FRAGMENT from '@/graphql/datasets/recordFragment.graphql'

export function useDatasetCurationTable() {
  const { resolveClient } = useApolloClient()
  const { updateRecords, removeRecords } = useMutateDatasets()
  const { validatePartialDatetime, normalizePartialDatetime } = useDatetimeUtils()
  const { parseValue } = useValueParser()
  const { updateItem: updateRecordInCache, deleteItem: deleteRecordFromCache } = useCacheUpdates({
    typename: 'Record',
    fragment: RECORD_FRAGMENT
  })

  // Table data - each row represents a unique (unitId, start, end) combination
  const tableData = ref([])

  // Cell metadata: { [rowId-conceptId]: { recordId, datasetId, originalValue, canEdit } }
  const cellMetadata = ref({})

  // Row metadata: { [rowId]: { originalStart, originalEnd, unitId } }
  const rowMetadata = ref({})

  // Concept data: { [conceptId]: { concept, datasetIds } }
  const conceptData = ref({})

  // Controller data: { [datasetId]: { canEdit, controller } }
  const datasetControllers = ref({})

  // Records marked for deletion: { [datasetId]: Set<recordId> }
  const recordsToDelete = ref({})

  // Column submission status: { [datasetId]: { status, error, submissionId } }
  const columnStatus = ref({})

  // Pending submissions tracking: { [datasetId]: { indexMapping, conceptId } }
  const pendingSubmissions = ref({})

  // Validation errors: { [rowIndex-columnKey]: { message, isWarning } }
  const cellErrors = ref({})

  // Cell references for complex scale types: { [rowId-conceptId]: referenceIds[] }
  const cellReferences = ref({})

  // Loading states
  const isLoading = ref(false)
  const isSubmitting = ref(false)

  // Active polling for submissions
  const activeSubmissions = ref({})


  // Scale helper functions
  const getScaleType = (concept) => concept?.scale?.scaleType || 'TEXT'

  const getCategories = (concept) => concept?.scale?.categories || []

  const isComplexScale = (concept) => getScaleType(concept) === 'COMPLEX'

  const isCategoricalScale = (concept) => {
    const scaleType = getScaleType(concept)
    return scaleType === 'ORDINAL' || scaleType === 'NOMINAL'
  }

  const isNumericScale = (concept) => {
    const scaleType = getScaleType(concept)
    return scaleType === 'NUMERICAL' || scaleType === 'DATE' || scaleType === 'DURATION'
  }


  /**
   * Initialize the curation table from datasets
   */
  const initializeFromDatasets = async (datasets, userCurateTeamIds) => {
    isLoading.value = true

    try {
      // Clear previous state
      tableData.value = []
      cellMetadata.value = {}
      rowMetadata.value = {}
      conceptData.value = {}
      datasetControllers.value = {}
      recordsToDelete.value = {}
      columnStatus.value = {}
      cellErrors.value = {}
      cellReferences.value = {}

      if (!datasets || datasets.length === 0) {
        return
      }

      // Extract all dataset IDs and fetch controllers
      const datasetIds = datasets.map(d => d.id)
      await fetchControllers(datasetIds, userCurateTeamIds)

      // Build concept data map
      datasets.forEach(dataset => {
        const conceptId = dataset.concept?.id
        if (!conceptId) return

        if (!conceptData.value[conceptId]) {
          conceptData.value[conceptId] = {
            concept: dataset.concept,
            datasetIds: []
          }
        }
        conceptData.value[conceptId].datasetIds.push(dataset.id)
      })

      // Build rows from records, grouping by (unitId, start, end)
      // Map: `${unitId}-${start}-${end}` -> array of row data (for disambiguation)
      const rowsByKey = new Map() // rowKey -> array of { rowId, rowData, conceptIds: Set }

      datasets.forEach(dataset => {
        const conceptId = dataset.concept?.id
        const datasetId = dataset.id
        if (!conceptId) return

        const records = dataset.records || []
        records.forEach(record => {
          const unitId = record.unit?.id
          if (!unitId) return

          const start = record.start || null
          const end = record.end || null
          const rowKey = `${unitId}-${start || 'null'}-${end || 'null'}`

          // Get or create the array of rows for this key
          if (!rowsByKey.has(rowKey)) {
            rowsByKey.set(rowKey, [])
          }
          const rowsForKey = rowsByKey.get(rowKey)

          // Find an existing row that doesn't have this concept yet
          let targetRow = rowsForKey.find(r => !r.conceptIds.has(conceptId))

          if (!targetRow) {
            // Need to create a new row
            const disambiguator = rowsForKey.length
            const rowId = disambiguator === 0 ? rowKey : `${rowKey}-${disambiguator}`

            targetRow = {
              rowId,
              rowData: {
                _rowId: rowId,
                unitId: unitId,
                unitLabel: record.unit?.name || `Unit ${unitId}`,
                startTime: start ? formatDatetimeForDisplay(start) : '',
                endTime: end ? formatDatetimeForDisplay(end) : '',
              },
              conceptIds: new Set()
            }
            rowsForKey.push(targetRow)

            // Store row metadata
            rowMetadata.value[rowId] = {
              originalStart: start,
              originalEnd: end,
              unitId: unitId
            }
          }

          // Track that this concept is now in this row
          targetRow.conceptIds.add(conceptId)

          // Add cell metadata
          const cellKey = `${targetRow.rowId}-${conceptId}`
          console.log('cellKey', cellKey)
          console.log('record.references', record.references)
          cellMetadata.value[cellKey] = {
            recordId: record.id,
            datasetId: datasetId,
            originalValue: record.value,
            originalReferences: record.references
              ? record.references.filter(r => r != null).map(r => r.id)
              : [],
            canEdit: datasetControllers.value[datasetId]?.canEdit || false
          }
          console.log('cellMetadata', cellMetadata.value[cellKey])

          // Add value to row
          targetRow.rowData[`concept_${conceptId}`] = record.value || ''

          // Store references for complex scale types
          const concept = dataset.concept
          if (isComplexScale(concept) && record.references) {
            const refCellKey = `${targetRow.rowId}-${conceptId}`
            cellReferences.value[refCellKey] = record.references
              .filter(r => r != null)
              .map(r => r.id)
          }

        })
      })

      // Flatten all rows and sort
      const allRows = []
      for (const rowsForKey of rowsByKey.values()) {
        for (const { rowData } of rowsForKey) {
          allRows.push(rowData)
        }
      }

      tableData.value = allRows.sort((a, b) => {
        // Sort by unitId, then by start time
        if (a.unitId !== b.unitId) return a.unitId - b.unitId
        return (a.startTime || '').localeCompare(b.startTime || '')
      })

      // Initialize column status for each dataset
      datasetIds.forEach(datasetId => {
        columnStatus.value[datasetId] = { status: 'pending' }
      })

    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch controllers for all datasets and determine edit permissions
   */
  const fetchControllers = async (datasetIds, userCurateTeamIds) => {
    if (!datasetIds || datasetIds.length === 0) return

    const client = resolveClient()

    try {
      const result = await client.query({
        query: CONTROLLERS_QUERY,
        variables: {
          entityLabel: 'DATASET',
          entityIds: datasetIds
        },
        fetchPolicy: 'network-only'
      })

      const controllers = result?.data?.controlsControllers?.result || []

      // Map controllers to dataset IDs (assumes same order)
      datasetIds.forEach((datasetId, index) => {
        const controller = controllers[index]

        // Check if user has curate access
        // User can edit if any of their curate teams matches controller teams
        const controllerTeamIds = (controller?.teams || []).map(t => t.id)
        const canEdit = userCurateTeamIds?.some(teamId =>
          controllerTeamIds.includes(teamId)
        ) || false

        datasetControllers.value[datasetId] = {
          canEdit,
          controller
        }
      })
    } catch (err) {
      console.error('Error fetching controllers:', err)
      // Default to no edit access on error
      datasetIds.forEach(datasetId => {
        datasetControllers.value[datasetId] = { canEdit: false, controller: null }
      })
    }
  }

  /**
   * Format datetime for display
   */
  const formatDatetimeForDisplay = (datetime) => {
    if (!datetime) return ''
    // Return as-is if already a string, or format if Date
    if (typeof datetime === 'string') {
      // Remove timezone info for display
      return datetime.replace('T', ' ').split('+')[0].split('Z')[0].trim()
    }
    return datetime.toString()
  }

  /**
   * Get concepts for column generation
   */
  const getConcepts = computed(() => {
    return Object.values(conceptData.value).map(cd => cd.concept)
  })

  /**
   * Check if a cell is editable
   */
  const isCellEditable = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return false

    // Prevent editing during submission
    if (isSubmitting.value) return false

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]

    // If no metadata, cell is empty and not editable
    if (!metadata) return false

    // Check if this dataset is currently being polled
    if (activeSubmissions.value[metadata.datasetId]) return false

    return metadata.canEdit
  }

  /**
   * Check if a cell has a record (for determining if it's empty)
   */
  const cellHasRecord = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return false

    const cellKey = `${row._rowId}-${conceptId}`
    return !!cellMetadata.value[cellKey]?.recordId
  }

  /**
   * Get cell metadata for display (e.g., showing controller badge)
   */
  const getCellInfo = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return null

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]
    if (!metadata) return null

    return {
      recordId: metadata.recordId,
      datasetId: metadata.datasetId,
      canEdit: metadata.canEdit,
      controller: datasetControllers.value[metadata.datasetId]?.controller
    }
  }

  /**
   * Get dataset ID for a cell
   */
  const getDatasetIdForCell = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return null

    const cellKey = `${row._rowId}-${conceptId}`
    return cellMetadata.value[cellKey]?.datasetId || null
  }

  /**
   * Update a cell value
   */
  const updateCell = (rowIndex, columnKey, value) => {
    if (!tableData.value[rowIndex]) return

    tableData.value = tableData.value.map((row, idx) =>
      idx === rowIndex ? { ...row, [columnKey]: value } : row
    )

    validateCell(rowIndex, columnKey, value)
  }

  /**
   * Validate a cell value
   */
  const validateCell = (rowIndex, columnKey, value) => {
    const errorKey = `${rowIndex}-${columnKey}`
    delete cellErrors.value[errorKey]

    if (!value || value === '') return true

    // Validate datetime columns
    if (columnKey === 'startTime' || columnKey === 'endTime') {
      if (!validatePartialDatetime(value)) {
        cellErrors.value[errorKey] = {
          message: 'Invalid datetime format. Use: YYYY, YYYY-MM, YYYY-MM-DD, or YYYY-MM-DDTHH:MM'
        }
        return false
      }
      return true
    }

    // Validate concept columns
    if (columnKey.startsWith('concept_')) {
      const conceptId = parseInt(columnKey.replace('concept_', ''))
      const concept = conceptData.value[conceptId]?.concept
      if (!concept) return true

      const categories = getCategories(concept)
      const result = parseValue(value, concept.scale, categories)

      if (result && typeof result === 'object' && result.error) {
        cellErrors.value[errorKey] = {
          message: result.error,
          isWarning: isCategoricalScale(concept)
        }
        return isCategoricalScale(concept)
      }
    }

    return true
  }

  /**
   * Get cell error
   */
  const getCellError = (rowIndex, columnKey) => {
    return cellErrors.value[`${rowIndex}-${columnKey}`] || null
  }

  /**
   * Mark a record for deletion
   */
  const markRecordForDeletion = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]

    if (!metadata?.recordId || !metadata?.datasetId) return
    if (!metadata.canEdit) return // Can't delete if no edit access

    const datasetId = metadata.datasetId
    if (!recordsToDelete.value[datasetId]) {
      recordsToDelete.value[datasetId] = new Set()
    }
    recordsToDelete.value[datasetId].add(metadata.recordId)

  }

    /**
   * Unmark a record for deletion (undo delete)
   */
  const unmarkRecordForDeletion = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]

    if (!metadata?.recordId || !metadata?.datasetId) return

    const datasetId = metadata.datasetId
    if (recordsToDelete.value[datasetId]) {
      recordsToDelete.value[datasetId].delete(metadata.recordId)

      // Restore the original value
      updateCell(rowIndex, `concept_${conceptId}`, metadata.originalValue || '')
    }
  }

  /**
   * Check if a record is marked for deletion
   */
  const isMarkedForDeletion = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return false

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]

    if (!metadata?.recordId || !metadata?.datasetId) return false

    return recordsToDelete.value[metadata.datasetId]?.has(metadata.recordId) || false
  }

  /**
   * Check if a value has changed from original
   */
  const hasValueChanged = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return false

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]
    if (!metadata) return false

    const concept = conceptData.value[conceptId]?.concept

    // For complex scales, compare reference IDs
    if (concept && isComplexScale(concept)) {
      const currentRefs = cellReferences.value[cellKey] || []
      const originalRefs = metadata.originalReferences || []

      if (currentRefs.length !== originalRefs.length) return true
      const sortedCurrent = [...currentRefs].sort()
      const sortedOriginal = [...originalRefs].sort()
      return !sortedCurrent.every((val, idx) => val === sortedOriginal[idx])
    }


    const currentValue = row[`concept_${conceptId}`] || ''
    const originalValue = metadata.originalValue || ''

    return currentValue !== originalValue
  }

  /**
   * Check if row times have changed
   */
  const hasRowTimesChanged = (rowIndex) => {
    const row = tableData.value[rowIndex]
    if (!row) return false

    const meta = rowMetadata.value[row._rowId]
    if (!meta) return false

    const currentStart = normalizePartialDatetime(row.startTime) || null
    const currentEnd = normalizePartialDatetime(row.endTime) || null

    return currentStart !== meta.originalStart || currentEnd !== meta.originalEnd
  }

  /**
   * Check if there are unsaved changes
   */
  const hasUnsavedChanges = computed(() => {
    // Check for deletions
    for (const datasetId in recordsToDelete.value) {
      if (recordsToDelete.value[datasetId].size > 0) return true
    }

    // Check for value changes
    for (let i = 0; i < tableData.value.length; i++) {
      const row = tableData.value[i]

      // Check time changes
      if (hasRowTimesChanged(i)) return true

      // Check concept value changes
      for (const conceptId in conceptData.value) {
        if (hasValueChanged(i, parseInt(conceptId))) return true
      }
    }

    return false
  })

  /**
   * Prepare updates for a specific dataset
   */
  const prepareDatasetUpdates = (datasetId) => {
    const updates = []
    const indexMapping = [] // Maps submission index -> table row index
    const conceptId = Object.keys(conceptData.value).find(cid =>
      conceptData.value[cid].datasetIds.includes(datasetId)
    )

    if (!conceptId) return { updates, indexMapping, conceptId: null }

    const concept = conceptData.value[conceptId]?.concept

    for (let i = 0; i < tableData.value.length; i++) {
      const row = tableData.value[i]
      const cellKey = `${row._rowId}-${conceptId}`
      const metadata = cellMetadata.value[cellKey]

      if (!metadata || metadata.datasetId !== datasetId) continue
      if (!metadata.recordId) continue // No existing record
      if (isMarkedForDeletion(i, parseInt(conceptId))) continue // Will be deleted

      const valueChanged = hasValueChanged(i, parseInt(conceptId))
      const timesChanged = hasRowTimesChanged(i)

      if (valueChanged || timesChanged) {
        const update = {
          recordId: metadata.recordId,
          start: normalizePartialDatetime(row.startTime) || null,
          end: normalizePartialDatetime(row.endTime) || null
        }

        // For complex scales, include referenceIds instead of value
        if (concept && isComplexScale(concept)) {
          const refs = cellReferences.value[cellKey] || []
          update.referenceIds = refs
          update.value = null
        } else {
          update.value = row[`concept_${conceptId}`] || null
        }

        updates.push(update)
        indexMapping.push(i) // Track the original row index
      }
    }
    return { updates, indexMapping, conceptId: parseInt(conceptId) }
  }

  /**
   * Submit all changes for all datasets
   */
  const submitAllChanges = async () => {
    isSubmitting.value = true

    try {
      // Get all unique dataset IDs that have changes
      const datasetsWithChanges = new Set()

      // Check deletions
      Object.keys(recordsToDelete.value).forEach(datasetId => {
        if (recordsToDelete.value[datasetId].size > 0) {
          datasetsWithChanges.add(parseInt(datasetId))
        }
      })

      // Check updates
      for (const conceptId in conceptData.value) {
        const datasetIds = conceptData.value[conceptId].datasetIds
        for (const datasetId of datasetIds) {
          const { updates } = prepareDatasetUpdates(datasetId)
          if (updates.length > 0) {
            datasetsWithChanges.add(datasetId)
          }
        }
      }

      // Process each dataset
      for (const datasetId of datasetsWithChanges) {
        columnStatus.value[datasetId] = { status: 'submitting' }

        try {
          // First, handle deletions
          const deletions = recordsToDelete.value[datasetId]
          if (deletions && deletions.size > 0) {
            const result = await removeRecords(datasetId, Array.from(deletions))
            if (result?.status !== 'SUCCESS') {
              throw new Error(result?.errors?.[0]?.message || 'Failed to delete records')
            }
            deletions.forEach(recordId => deleteRecordFromCache({itemId: recordId}))
          }

          // Then, handle updates
          const { updates, indexMapping, conceptId } = prepareDatasetUpdates(datasetId)
          if (updates.length > 0) {
            const result = await updateRecords({
              datasetId,
              records: updates
            })

            if (result?.status === 'SUCCESS' || result?.result) {
              // Start polling for submission status
              const submissionId = result.result
              if (submissionId) {
                // Store the mapping for error handling when polling completes
                pendingSubmissions.value[datasetId] = { indexMapping, conceptId, updates }
                startSubmissionPolling(datasetId, submissionId)
              }
            } else {
              throw new Error(result?.errors?.[0]?.message || 'Update failed')
            }
          } else if (deletions && deletions.size > 0) {
            // Only deletions, no updates
            columnStatus.value[datasetId] = { status: 'success' }
          }

        } catch (err) {
          console.error(`Error updating dataset ${datasetId}:`, err)
          columnStatus.value[datasetId] = {
            status: 'error',
            error: err.message
          }
        }
      }

    } finally {
      isSubmitting.value = false
    }
  }

    /**
   * Map item errors back to original row indices
   */
  const mapItemErrors = (itemErrors, indexMapping) => {
    if (!itemErrors || !indexMapping) return []

    return itemErrors.map(err => ({
      originalIndex: indexMapping[err.index],
      error: err.error,
    }))
  }

  /**
  * Populate cellErrors from item errors
  */
  const populateCellErrorsFromItemErrors = (itemErrors, columnKey) => {
    if (!itemErrors || itemErrors.length === 0) return

    itemErrors.forEach((itemError) => {
      const errorKey = `${itemError.originalIndex}-${columnKey}`
      cellErrors.value[errorKey] = {
        message: itemError.error,
        isWarning: false,
        isServerError: true
      }
    })
  }

  /**
   * Start polling for a submission using the shared utility
   */
  const startSubmissionPolling = (datasetId, submissionId) => {
    const client = resolveClient()

    const onSubmissionComplete = ({ status, errors, itemErrors }) => {
      const pending = pendingSubmissions.value[datasetId]
      const { indexMapping, conceptId, updates } = pending || {}

      if (status === 'COMPLETED') {
        if (updates && updates.length > 0) {
              updates.forEach(update => {
                updateRecordInCache({
                  updateData: {
                    id: update.recordId,
                    value: update.value,
                    start: update.start,
                    end: update.end
                  },
                  idField: 'id'
                })
              })
            }


        columnStatus.value[datasetId] = { status: 'success' }
      } else if (status === 'FAILED' || errors || itemErrors) {
        // Map item errors back to cells
        if (itemErrors && indexMapping && conceptId) {
          const mappedItemErrors = mapItemErrors(itemErrors, indexMapping)
          const columnKey = `concept_${conceptId}`
          populateCellErrorsFromItemErrors(mappedItemErrors, columnKey)
        }

        const errorMsg = errors?.join?.(', ') || errors || 'Submission failed'
        columnStatus.value[datasetId] = { status: 'error', error: errorMsg }
      }

      // Clean up pending submission tracking
      delete pendingSubmissions.value[datasetId]
      // Clean up active submissions so the column becomes editable again
      delete activeSubmissions.value[datasetId]
      stopPolling()
    }

    const { startPolling, stopPolling } = pollDatasetSubmission({
      client,
      submissionId,
      onComplete: onSubmissionComplete
    })

    // Store stopPolling for cleanup
    activeSubmissions.value[datasetId] = { stopPolling }

    startPolling()
  }

  /**
   * Export visible data as CSV
   */
  const exportToCSV = (visibleColumns, filename = 'dataset_curation.csv') => {
    const rows = tableData.value
    if (rows.length === 0) return

    // Build header row
    const headers = visibleColumns.map(col => col.header || col.id)

    // Build data rows
    const csvRows = [headers.join(',')]

    rows.forEach(row => {
      const values = visibleColumns.map(col => {
        let value = row[col.id] || ''
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string') {
          value = value.replace(/"/g, '""')
          if (value.includes(',') || value.includes('\n') || value.includes('"')) {
            value = `"${value}"`
          }
        }
        return value
      })
      csvRows.push(values.join(','))
    })

    // Create and download file
    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    URL.revokeObjectURL(link.href)
  }

    /**
   * Get references for a complex scale cell
   */
  const getCellReferences = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return []

    const cellKey = `${row._rowId}-${conceptId}`
    return cellReferences.value[cellKey] || []
  }

    /**
   * Update references for a complex scale cell
   */
  const updateCellReferences = (rowIndex, conceptId, referenceIds) => {
    const row = tableData.value[rowIndex]
    if (!row) return

    const cellKey = `${row._rowId}-${conceptId}`
    cellReferences.value[cellKey] = referenceIds || []
  }

  /**
   * Get status for a dataset
   */
  const getDatasetStatus = (datasetId) => {
    return columnStatus.value[datasetId] || { status: 'pending' }
  }

  /**
   * Check if all submissions completed successfully
   */
  const allSubmitted = computed(() => {
    const statuses = Object.values(columnStatus.value)
    if (statuses.length === 0) return false
    return statuses.every(s => s.status === 'success')
  })

  /**
   * Clean up on close
   */
  const cleanup = () => {
    tableData.value = []
    cellMetadata.value = {}
    rowMetadata.value = {}
    conceptData.value = {}
    datasetControllers.value = {}
    recordsToDelete.value = {}
    columnStatus.value = {}
    cellErrors.value = {}
    cellReferences.value = {}
    pendingSubmissions.value = {}

    // Stop any active polling
    Object.values(activeSubmissions.value).forEach(sub => {
      if (sub.stopPolling) sub.stopPolling()
    })
    activeSubmissions.value = {}
  }

  return {
    // State
    tableData,
    cellMetadata,
    conceptData,
    datasetControllers,
    columnStatus,
    cellErrors,
    cellReferences,
    isLoading,
    isSubmitting,
    hasUnsavedChanges,
    allSubmitted,

    // Computed
    getConcepts,

    // Methods
    initializeFromDatasets,
    isCellEditable,
    cellHasRecord,
    getCellInfo,
    getDatasetIdForCell,
    updateCell,
    validateCell,
    getCellError,
    markRecordForDeletion,
    unmarkRecordForDeletion,
    isMarkedForDeletion,
    hasValueChanged,
    hasRowTimesChanged,
    getCellReferences,
    updateCellReferences,
    submitAllChanges,
    exportToCSV,
    getDatasetStatus,
    cleanup,

    // Scale helpers
    getScaleType,
    getCategories,
    isComplexScale,
    isCategoricalScale,
    isNumericScale,
  }
}