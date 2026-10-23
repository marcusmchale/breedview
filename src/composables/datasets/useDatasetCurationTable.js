import { contributionsInput, contributionsKey } from '@/composables/people/personDisplay'
import { ref, computed } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import { useMutateDatasets } from './mutateDatasets'
import { useDatetimeUtils, periodStart, periodEnd } from '@/composables/parsers/partialDatetime'
import { useValueParser } from '@/composables/parsers/valueParser'
import { pollDatasetSubmission } from "@/composables/datasets/datasetSubmissionQuery";
import { useCacheUpdates } from "@/apolloConfig/cacheUpdates";
import { timeSpan, codeKey, describingRecords } from './factorApplication'
import { DEFAULT_ROW_MODE, layoutRows, recordTimeLabel } from './curationRows'
import { placeAt } from '@/composables/units/unitPositions'

import CONTROLLER_ACCESS_QUERY from '@/graphql/controls/controllerAccess.graphql'
import { useAuthStore } from '@/composables/user/useAuthStore'
import RECORD_FRAGMENT from '@/graphql/datasets/recordFragment.graphql'

export function useDatasetCurationTable() {
  const { resolveClient } = useApolloClient()
  const { isAuthenticated } = useAuthStore()
  const { updateDataset, removeRecords } = useMutateDatasets()
  const { validatePartialDatetime } = useDatetimeUtils()
  const { parseValue } = useValueParser()
  const { updateCache: updateRecordInCache, deleteFromCache: deleteRecordFromCache } = useCacheUpdates({
    typename: 'Record',
    fragment: RECORD_FRAGMENT
  })

  // Table data: each row holds a unit's records at one time, within one period, or one record, as rowMode lays them out
  const tableData = ref([])
  // How records are laid out in rows (curationRows.js): by record, time, day, month or year
  const rowMode = ref(DEFAULT_ROW_MODE)

  // Cell metadata: { [rowId-conceptId]: { recordId, datasetId, originalValue, canEdit, start, end } }, with the
  // record's own times, which a row by period doesn't show
  const cellMetadata = ref({})

  // Row metadata: { [rowId]: { originalStart, originalEnd, unitId } }
  const rowMetadata = ref({})

  // Concept data: { [conceptId]: { concept, datasetIds } }
  const conceptData = ref({})

  // Controller data: { [datasetId]: { canEdit, controller } }
  const datasetControllers = ref({})

  // Contributors of each dataset: { [datasetId]: { original, contributions, people } }: the contributions as loaded
  // (their key), as edited ([{ personId, roleIds }]), and the Persons as loaded
  const datasetContributors = ref({})

  // Records marked for deletion: { [datasetId]: Set<recordId> }
  const recordsToDelete = ref({})
  // When changes were last saved: kept when the table is rebuilt from the saved records, which clears columnStatus
  const lastSavedAt = ref(null)

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

  // ---- Record groupings ----
  // [{ key, id, name, scope, extent, studyId }] - one column per grouping (groupings belong to one study)
  const groupingColumns = ref([])
  // { [datasetId]: studyId }
  const datasetStudyIds = ref({})

  const groupingKey = (groupingId) => `group_${groupingId}`
  const isGroupingKey = (columnKey) => typeof columnKey === 'string' && columnKey.startsWith('group_')
  const normalizeCode = (value) => String(value ?? '').trim()
  const getGroupingColumn = (columnKey) => groupingColumns.value.find((c) => c.key === columnKey)

  // { [groupingId]: code }
  const recordGroupCodes = (record) => {
    const codes = {}
    ;(record.groups || []).forEach((g) => {
      if (g?.id != null) codes[g.id] = normalizeCode(g.code)
    })
    return codes
  }

  const buildGroupingColumns = (groupingsByStudy, datasets) => {
    const columns = new Map()
    Object.entries(groupingsByStudy || {}).forEach(([studyId, groupings]) => {
      (groupings || []).forEach((g) => {
        columns.set(String(g.id), {
          key: groupingKey(g.id), id: g.id, name: g.name, scope: g.scope, extent: g.extent ?? 'SHARED', studyId,
          // the datasets within which codes of a DATASET_SCOPED grouping are comparable
          datasetScopes: (g.dataset_scopes ?? []).map((scope) => (scope.datasetIds ?? []).map(String))
        })
      })
    })
    // Records may reference groupings not returned for the loaded studies: show read-only, treated as SHARED
    datasets.forEach((d) => (d.records || []).forEach((r) => (r.groups || []).forEach((g) => {
      if (g?.id != null && !columns.has(String(g.id))) {
        columns.set(String(g.id), {
          key: groupingKey(g.id), id: g.id, name: `Grouping ${g.id}`, scope: null, extent: 'SHARED', studyId: null
        })
      }
    })))
    return [...columns.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  // Row sections, split by the values of DATASET_SCOPED groupings with SHARED or WITHIN_GRAPH extent.
  // WITHIN_UNIT codes (replicates) only mean something within a unit, so they stay ordinary columns.
  const sectionColumns = computed(() =>
    groupingColumns.value.filter((c) => c.scope === 'DATASET_SCOPED' && c.extent !== 'WITHIN_UNIT')
  )
  // Of those, the ones with a code in some loaded row: the others put every row in the same section, so they are
  // left out of the labels
  const datasetScopedColumns = computed(() =>
    sectionColumns.value.filter((c) => tableData.value.some((row) => normalizeCode(row?.[c.key])))
  )
  const withinUnitColumns = computed(() =>
    groupingColumns.value.filter((c) => c.extent === 'WITHIN_UNIT')
  )

  const sectionKey = (columns, row) => columns.map((c) => normalizeCode(row?.[c.key])).join('\u0000')
  const hasFactorRows = computed(() => tableData.value.some((row) => row._kind === 'factor'))
  // Factor rows form one section, before the variable rows' sections
  const getRowSectionKey = (row) =>
    (row?._kind === 'factor' ? '\u0001factor' : sectionKey(datasetScopedColumns.value, row))

  const getRowSectionLabel = (row) => {
    if (row?._kind === 'factor') return 'Factor records'
    if (datasetScopedColumns.value.length === 0) return 'Variable records'
    return datasetScopedColumns.value
      .map((c) => `${c.name}: ${normalizeCode(row?.[c.key]) || '(none)'}`)
      .join(' · ')
  }

  const rowSections = computed(() => {
    if (datasetScopedColumns.value.length === 0 && !hasFactorRows.value) return []
    const sections = new Map()
    tableData.value.forEach((row, index) => {
      const key = getRowSectionKey(row)
      if (!sections.has(key)) {
        sections.set(key, { key, label: getRowSectionLabel(row), rowIndices: [] })
      }
      sections.get(key).rowIndices.push(index)
    })
    return [...sections.values()]
  })

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
   * groupingContext: { groupingsByStudy: { [studyId]: [Grouping] }, datasetStudyIds: { [datasetId]: studyId } }
   */
  const initializeFromDatasets = async (datasets, groupingContext) => {
    isLoading.value = true

    try {
      // Clear previous state
      tableData.value = []
      cellMetadata.value = {}
      rowMetadata.value = {}
      conceptData.value = {}
      datasetControllers.value = {}
      datasetContributors.value = {}
      recordsToDelete.value = {}
      columnStatus.value = {}
      cellErrors.value = {}
      cellReferences.value = {}
      groupingColumns.value = []
      datasetStudyIds.value = { ...(groupingContext.datasetStudyIds || {}) }

      if (!datasets || datasets.length === 0) {
        return
      }
      // Fallback if the datasets query returns the study
      datasets.forEach((d) => {
        if (datasetStudyIds.value[d.id] == null && d.study?.id != null) {
          datasetStudyIds.value[d.id] = d.study.id
        }
      })
      groupingColumns.value = buildGroupingColumns(groupingContext.groupingsByStudy, datasets)

      // Extract all dataset IDs and fetch controllers
      const datasetIds = datasets.map(d => d.id)
      await fetchControllers(datasetIds)

      // Contributions as loaded ({ personId, roleIds }), so changes to them can be told apart and submitted: saving
      // replaces the dataset's contributions
      datasets.forEach(dataset => {
        const contributions = contributionsInput(dataset.contributions)
        const people = (dataset.contributions ?? []).map(c => c?.person).filter(Boolean)
        datasetContributors.value[dataset.id] = { original: contributionsKey(contributions), contributions, people }
      })

      // Build concept data map
      datasets.forEach(dataset => {
        const conceptId = dataset.concept?.id
        if (conceptId == null) return

        if (!conceptData.value[conceptId]) {
          conceptData.value[conceptId] = {
            concept: dataset.concept,
            datasetIds: []
          }
        }
        conceptData.value[conceptId].datasetIds.push(dataset.id)
      })

      // Every record, laid out in rows by the chosen view
      const entries = []
      datasets.forEach(dataset => {
        const conceptId = dataset.concept?.id
        if (conceptId == null) return
        // Factor records describe a unit and the units below it (for every time when undated), not an observation:
        // they never share a row with variable records
        const kind = dataset.concept?.__typename === 'Factor' ? 'factor' : 'variable'
        const complex = isComplexScale(dataset.concept)

        ;(dataset.records || []).forEach(record => {
          const unitId = record.unit?.id
          if (unitId == null) return
          const references = (record.references ?? []).filter(r => r != null)
          entries.push({
            kind,
            unitId,
            unitLabel: record.unit?.name || `Unit ${unitId}`,
            conceptId,
            datasetId: dataset.id,
            recordId: record.id,
            // as the API gives them, so that display and comparison use one form
            start: record.start || null,
            end: record.end || null,
            codes: recordGroupCodes(record),
            value: record.value ?? '',
            originalValue: record.value,
            originalReferences: references.map(r => r.id),
            references: complex && record.references ? references.map(({ id, __typename }) => ({ id, __typename })) : null,
            canEdit: datasetControllers.value[dataset.id]?.canEdit || false
          })
        })
      })
      layout(entries)

      // Initialize column status for each dataset
      datasetIds.forEach(datasetId => {
        columnStatus.value[datasetId] = { status: 'pending' }
      })

    } finally {
      isLoading.value = false
    }
  }

  // What a row's records share of their group codes, as a key: records with different codes never share a row
  const codesKey = (codes) => groupingColumns.value.map((c) => codes[c.id] ?? '').join('|')

  const compareRows = (a, b) => {
    // Factor records first, in a section of their own
    if (a._kind !== b._kind) return a._kind === 'factor' ? -1 : 1
    // Keep DATASET_SCOPED sections contiguous (by every candidate grouping, as tableData isn't set yet)
    const sa = sectionKey(sectionColumns.value, a)
    const sb = sectionKey(sectionColumns.value, b)
    if (sa !== sb) return sa.localeCompare(sb, undefined, { numeric: true })
    // Units by id, as their pages are made (useDatasetRecordPages): ids compared as numbers, not text, which put 10
    // before 2
    if (a.unitId !== b.unitId) return Number(a.unitId) - Number(b.unitId)
    const byTime = (a.startTime || '').localeCompare(b.startTime || '')
      || (a.endTime || '').localeCompare(b.endTime || '')
    if (byTime) return byTime
    // A unit's replicates stay together, in code order
    for (const c of withinUnitColumns.value) {
      const byCode = normalizeCode(a[c.key]).localeCompare(normalizeCode(b[c.key]), undefined, { numeric: true })
      if (byCode) return byCode
    }
    return 0
  }

  /**
   * Lay records out in rows by rowMode, each row and cell with its baseline. A record is an entry, as
   * initializeFromDatasets reads them and entriesFromTable gives them back: { kind, unitId, unitLabel, conceptId,
   * datasetId, recordId, start, end, codes, value, originalValue, originalReferences, references, canEdit }
   */
  const layout = (entries) => {
    cellMetadata.value = {}
    rowMetadata.value = {}
    cellErrors.value = {}
    cellReferences.value = {}
    tableData.value = layoutRows(entries, rowMode.value, (entry) => codesKey(entry.codes))
      .map(({ rowId, start, end, period, entries: recordsOfRow }) => {
        const [{ kind, unitId, unitLabel, codes }] = recordsOfRow
        const rowData = {
          _rowId: rowId,
          _kind: kind,
          // the period the row stands for, whose records have times of their own (in their cells' metadata)
          _period: period,
          unitId,
          unitLabel,
          startTime: start ?? '',
          endTime: end ?? '',
        }
        groupingColumns.value.forEach((c) => {
          rowData[c.key] = codes[c.id] ?? ''
        })
        rowMetadata.value[rowId] = {
          originalStart: start,
          originalEnd: end,
          unitId,
          originalGroups: Object.fromEntries(groupingColumns.value.map((c) => [c.key, codes[c.id] ?? ''])),
          datasetIds: new Set(recordsOfRow.map((entry) => entry.datasetId))
        }
        recordsOfRow.forEach((entry) => {
          const cellKey = `${rowId}-${entry.conceptId}`
          cellMetadata.value[cellKey] = {
            recordId: entry.recordId,
            datasetId: entry.datasetId,
            originalValue: entry.originalValue,
            originalReferences: entry.originalReferences,
            canEdit: entry.canEdit,
            start: entry.start,
            end: entry.end
          }
          rowData[`concept_${entry.conceptId}`] = entry.value
          // the files a record on a complex scale cites
          if (entry.references) cellReferences.value[cellKey] = entry.references
        })
        return rowData
      })
      .sort(compareRows)
    applyUnitDetails()
  }

  // The records as the table holds them, with their values as shown and baselines as last saved, to lay them out again
  const entriesFromTable = () => tableData.value.flatMap((row) => {
    const codes = Object.fromEntries(groupingColumns.value.map((c) => [c.id, normalizeCode(row[c.key])]))
    return Object.keys(conceptData.value).flatMap((conceptId) => {
      const cellKey = `${row._rowId}-${conceptId}`
      const metadata = cellMetadata.value[cellKey]
      if (!metadata) return []
      return [{
        kind: row._kind,
        unitId: row.unitId,
        unitLabel: row.unitLabel,
        conceptId,
        datasetId: metadata.datasetId,
        recordId: metadata.recordId,
        ...recordTimes(row, metadata),
        codes,
        value: row[`concept_${conceptId}`] ?? '',
        originalValue: metadata.originalValue,
        originalReferences: metadata.originalReferences,
        references: cellReferences.value[cellKey] ?? null,
        canEdit: datasetControllers.value[metadata.datasetId]?.canEdit ?? metadata.canEdit
      }]
    })
  })

  /**
   * Fetch controllers for all datasets and determine edit permissions. Visitors edit nothing and are shown no
   * controllers, so nothing is asked for them.
   */
  const fetchControllers = async (datasetIds) => {
    if (!datasetIds || datasetIds.length === 0) return
    if (!isAuthenticated.value) {
      datasetIds.forEach((datasetId) => {
        datasetControllers.value[datasetId] = { canEdit: false, controller: null }
      })
      return
    }

    const client = resolveClient()

    try {
      const result = await client.query({
        query: CONTROLLER_ACCESS_QUERY,
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

        // the user can edit with curate access to a team controlling the dataset
        const canEdit = controller?.access?.includes('CURATE') ?? false

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

  // Read again what the user may do with each loaded dataset, e.g. after a change of control
  const refreshControllers = () => fetchControllers(Object.keys(datasetControllers.value))

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
    return cellMetadata.value[cellKey]?.recordId != null
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
    return cellMetadata.value[cellKey]?.datasetId ?? null
  }

  /**
   * Grouping cells are shared by every record in the row: the user must be able to edit
   * all datasets in the row, and all of them must belong to the grouping's study.
   */
  const isGroupCellEditable = (rowIndex, columnKey) => {
    const row = tableData.value[rowIndex]
    if (!row || isSubmitting.value) return false

    const column = getGroupingColumn(columnKey)
    const datasetIds = [...(rowMetadata.value[row._rowId]?.datasetIds || [])]
    if (!column?.studyId || datasetIds.length === 0) return false

    return datasetIds.every((datasetId) =>
      !activeSubmissions.value[datasetId]
      && datasetControllers.value[datasetId]?.canEdit
      && String(datasetStudyIds.value[datasetId]) === String(column.studyId)
    )
  }

  /**
   * Check if row group codes have changed
   */
  const hasRowGroupsChanged = (rowIndex) => {
    const row = tableData.value[rowIndex]
    const meta = row && rowMetadata.value[row._rowId]
    if (!meta?.originalGroups) return false
    return groupingColumns.value.some(
      (c) => normalizeCode(row[c.key]) !== (meta.originalGroups[c.key] ?? '')
    )
  }

  /**
   * Full RecordGroupInput list for a row, limited to groupings of the dataset's study
   */
  const buildGroupsInput = (row, datasetId) => {
    const studyId = datasetStudyIds.value[datasetId]
    return groupingColumns.value
      .filter((c) => c.studyId != null && String(c.studyId) === String(studyId))
      .map((c) => ({ id: c.id, code: normalizeCode(row[c.key]) }))
      .filter((g) => g.code)
  }

  // Distinct codes already present for a grouping column (input suggestions)
  const getGroupValueOptions = (columnKey) =>
    [...new Set(tableData.value.map((row) => normalizeCode(row[columnKey])).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

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

    // Grouping columns: free-text codes; warn when clearing an existing assignment
    if (isGroupingKey(columnKey)) {
      const row = tableData.value[rowIndex]
      const original = rowMetadata.value[row?._rowId]?.originalGroups?.[columnKey]
      if (original && !normalizeCode(value)) {
        cellErrors.value[errorKey] = {
          message: 'Clearing this value removes the records in this row from the group',
          isWarning: true
        }
      }
      return true
    }

    if (columnKey === 'startTime' || columnKey === 'endTime') return validateTimes(rowIndex)

    if (value == null || value === '') return true

    // Validate concept columns
    if (columnKey.startsWith('concept_')) {
      const conceptId = columnKey.replace('concept_', '')
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
   * A row's start and end, checked together: each changed one a partial datetime, and the end not before the start.
   * Times as the API gives them are not checked again (a time of day comes with a space for the T).
   */
  const validateTimes = (rowIndex) => {
    const row = tableData.value[rowIndex]
    const meta = rowMetadata.value[row?._rowId]
    const times = { startTime: rowTime(row?.startTime), endTime: rowTime(row?.endTime) }
    const original = { startTime: meta?.originalStart ?? null, endTime: meta?.originalEnd ?? null }
    let valid = true
    for (const key of Object.keys(times)) {
      delete cellErrors.value[`${rowIndex}-${key}`]
      if (times[key] && times[key] !== original[key] && !validatePartialDatetime(times[key])) {
        cellErrors.value[`${rowIndex}-${key}`] = {
          message: 'Invalid datetime format. Use: YYYY, YYYY-MM, YYYY-MM-DD, or YYYY-MM-DDTHH:MM'
        }
        valid = false
      }
    }
    const from = periodStart(times.startTime?.replace(' ', 'T'))
    const to = periodEnd(times.endTime?.replace(' ', 'T'))
    if (valid && from != null && to != null && to <= from) {
      cellErrors.value[`${rowIndex}-endTime`] = { message: 'The end is before the start' }
      valid = false
    }
    return valid
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

    if (metadata?.recordId == null || metadata?.datasetId == null) return
    if (!metadata.canEdit) return // Can't delete if no edit access

    const datasetId = metadata.datasetId
    if (!recordsToDelete.value[datasetId]) {
      recordsToDelete.value[datasetId] = new Set()
    }
    recordsToDelete.value[datasetId].add(metadata.recordId)
    // deleted, a record on a complex scale needs no file
    if (isComplexScale(conceptData.value[conceptId]?.concept)) validateCellReferences(rowIndex, conceptId)
  }

    /**
   * Unmark a record for deletion (undo delete)
   */
  const unmarkRecordForDeletion = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (!row) return

    const cellKey = `${row._rowId}-${conceptId}`
    const metadata = cellMetadata.value[cellKey]

    if (metadata?.recordId == null || metadata?.datasetId == null) return

    const datasetId = metadata.datasetId
    if (recordsToDelete.value[datasetId]) {
      recordsToDelete.value[datasetId].delete(metadata.recordId)

      // Restore the original value
      updateCell(rowIndex, `concept_${conceptId}`, metadata.originalValue ?? '')
      // and check the files of a record on a complex scale again, which updateCell does not
      if (isComplexScale(conceptData.value[conceptId]?.concept)) validateCellReferences(rowIndex, conceptId)
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

    if (metadata?.recordId == null || metadata?.datasetId == null ) return false

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
      // the cell holds references, the baseline their ids
      const currentIds = (cellReferences.value[cellKey] || []).map((reference) => String(reference.id)).sort()
      const originalIds = (metadata.originalReferences || []).map(String).sort()
      return currentIds.length !== originalIds.length || currentIds.some((id, i) => id !== originalIds[i])
    }

    const currentValue = row[`concept_${conceptId}`] ?? ''
    const originalValue = metadata.originalValue ?? ''

    return currentValue !== originalValue
  }

  /* ---------- the units' germplasm and location ---------- */

  // { [unitId]: Unit } of the loaded page, as they arrive (before or after the records)
  const unitDetails = ref({})

  const describeUnit = (row) => {
    const unit = unitDetails.value[String(row.unitId)]
    // where the unit was at the row's time: its own position then, or that of the nearest unit above it
    const position = placeAt([unit, ...(unit?.ancestors ?? [])], row.startTime || row.endTime)
    // its own germplasm, else what it inherits from the units above it
    const germplasm = unit?.germplasm ?? unit?.inheritedGermplasm?.germplasm
    row.germplasmName = germplasm?.name ?? ''
    row.germplasmId = germplasm?.id ?? ''
    row.locationName = position?.location?.name ?? ''
    row.locationId = position?.location?.id ?? ''
  }

  const applyUnitDetails = () => tableData.value.forEach(describeUnit)

  const setUnitDetails = (unitsById) => {
    unitDetails.value = unitsById ?? {}
    applyUnitDetails()
  }

  /* ---------- the factors applied to variable rows (see factorApplication.js) ---------- */

  // A page holds the factor records on its units and on every unit above them (useDatasetRecordPages), as factor
  // rows: they are what describes its variable rows, with their edits.

  const isFactor = (concept) => concept?.__typename === 'Factor'
  // A column per factor, when there are variables for it to describe
  const appliedFactors = computed(() => {
    const concepts = getConcepts.value
    return concepts.some((c) => !isFactor(c)) ? concepts.filter(isFactor) : []
  })
  const appliedKey = (conceptId) => `applied_${conceptId}`
  const appliedConceptId = (columnKey) =>
    (typeof columnKey === 'string' && columnKey.startsWith('applied_') ? columnKey.slice('applied_'.length) : null)

  // { [conceptId]: { [unitId]: [record] } } with each record's span and code keys
  const factorIndex = computed(() => {
    const factorIds = new Set(appliedFactors.value.map((c) => String(c.id)))
    const index = {}
    const add = (conceptId, record) => {
      const codeKeys = {}
      groupingColumns.value.forEach((c) => {
        const code = normalizeCode(record.codes[c.id])
        if (code) codeKeys[c.id] = codeKey(c, code, record.datasetId, record.unitId)
      })
      const byUnit = (index[conceptId] ??= {})
      ;(byUnit[record.unitId] ??= []).push({ ...record, span: timeSpan(record.start, record.end), codeKeys })
    }
    if (factorIds.size === 0) return index

    // the page's factor rows, as edited; records marked for deletion describe nothing
    tableData.value.forEach((row, rowIndex) => {
      if (row._kind !== 'factor') return
      factorIds.forEach((conceptId) => {
        const metadata = cellMetadata.value[`${row._rowId}-${conceptId}`]
        const value = String(row[`concept_${conceptId}`] ?? '').trim()
        if (!value || isMarkedForDeletion(rowIndex, conceptId)) return
        add(conceptId, {
          recordId: metadata?.recordId ?? null,
          datasetId: metadata?.datasetId ?? conceptData.value[conceptId]?.datasetIds[0],
          unitId: String(row.unitId),
          unitName: row.unitLabel,
          ...recordTimes(row, metadata),
          codes: Object.fromEntries(groupingColumns.value.map((c) => [c.id, row[c.key]])),
          value
        })
      })
    })
    return index
  })

  // A unit's parents, as the page's units and the units above them were read
  const parentsOf = (unitId) => (unitDetails.value[String(unitId)]?.parents ?? []).map((parent) => String(parent.id))

  const describedTimes = (records) => {
    const times = records.filter((r) => r.start || r.end).map((r) => (r.start && r.end && r.start !== r.end ? `${r.start} to ${r.end}` : r.start || r.end))
    if (times.length === 0) return 'all times'
    const undated = records.length > times.length ? ', and undated' : ''
    return `${[...new Set(times)].join(', ')}${undated} (overlapping this row's time; an analysis takes the time bin a record falls in)`
  }

  /**
   * The value of a factor describing a variable row, and where it comes from: { value, title }, or null.
   * Records of the same unit describing the row are all given, their values joined.
   */
  const getAppliedFactor = (row, conceptId) => {
    if (!row || row._kind === 'factor') return null
    const recordsByUnit = factorIndex.value[String(conceptId)]
    if (!recordsByUnit) return null
    const datasetIds = [...(rowMetadata.value[row._rowId]?.datasetIds ?? [])]
    const codeKeys = {}
    groupingColumns.value.forEach((c) => {
      const code = normalizeCode(row[c.key])
      if (code) codeKeys[c.id] = new Set(datasetIds.map((datasetId) => codeKey(c, code, datasetId, row.unitId)))
    })
    const found = describingRecords(
      { span: timeSpan(rowTime(row.startTime), rowTime(row.endTime)), codeKeys },
      recordsByUnit,
      row.unitId,
      parentsOf
    )
    if (!found) return null
    if (found.conflict) {
      const names = found.conflict.map(({ records }) => records[0].unitName)
      return {
        value: '—',
        title: `The records of ${names.join(' and ')} differ, so none describes this row, as in an analysis`
      }
    }
    const { records } = found
    const unitName = records[0].unitName
    const own = String(found.unitId) === String(row.unitId)
    return {
      value: [...new Set(records.map((r) => r.value))].join(', '),
      title: `From ${own ? 'this unit' : unitName}, ${describedTimes(records)}`
    }
  }

  // A row's time as shown, or null when empty: an unchanged time is sent back exactly as the API gave it
  const rowTime = (value) => String(value ?? '').trim() || null

  // A record's times as they stand: its row's, as edited, unless the row stands for a period, whose records keep their
  // own
  const recordTimes = (row, metadata) => (row._period != null
    ? { start: metadata?.start ?? null, end: metadata?.end ?? null }
    : { start: rowTime(row.startTime), end: rowTime(row.endTime) })

  /**
   * A row's start and end can be edited where it holds one record, as rows by record do, which the user can curate
   * and which is neither being saved nor marked for deletion
   */
  const isTimeCellEditable = (rowIndex) => {
    const row = tableData.value[rowIndex]
    if (!row || rowMode.value !== 'record' || isSubmitting.value) return false
    const conceptId = Object.keys(conceptData.value).find((id) => cellMetadata.value[`${row._rowId}-${id}`])
    const metadata = conceptId != null && cellMetadata.value[`${row._rowId}-${conceptId}`]
    return !!metadata && metadata.canEdit && !activeSubmissions.value[metadata.datasetId]
      && !isMarkedForDeletion(rowIndex, conceptId)
  }

  /** A cell's record's own time, for its title where its row stands for a period; null elsewhere */
  const getCellTime = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    if (row?._period == null) return null
    const metadata = cellMetadata.value[`${row._rowId}-${conceptId}`]
    return metadata ? recordTimeLabel(metadata.start, metadata.end) : null
  }

  /**
   * Check if row times have changed
   */
  const hasRowTimesChanged = (rowIndex) => {
    const row = tableData.value[rowIndex]
    if (!row) return false

    const meta = rowMetadata.value[row._rowId]
    if (!meta) return false

    return rowTime(row.startTime) !== meta.originalStart || rowTime(row.endTime) !== meta.originalEnd
  }

  /**
   * Check if there are unsaved changes
   */
  /* ---------- contributors ---------- */

  const hasContributorsChanged = (datasetId) => {
    const entry = datasetContributors.value[datasetId]
    return !!entry && contributionsKey(entry.contributions) !== entry.original
  }

  // Contributors can be changed by whoever can curate the dataset, while it is not being saved
  const canEditContributors = (datasetId) =>
    !isSubmitting.value && !activeSubmissions.value[datasetId] && !!datasetControllers.value[datasetId]?.canEdit

  const setContributors = (datasetId, contributions) => {
    const entry = datasetContributors.value[datasetId]
    if (!entry || !canEditContributors(datasetId)) return
    entry.contributions = contributions ?? []
  }

  const hasUnsavedChanges = computed(() => {
    // Check for deletions
    for (const datasetId in recordsToDelete.value) {
      if (recordsToDelete.value[datasetId].size > 0) {
        return true
      }
    }

    // Check for contributor changes
    for (const datasetId in datasetContributors.value) {
      if (hasContributorsChanged(datasetId)) {
        return true
      }
    }

    // Check for value changes
    for (let i = 0; i < tableData.value.length; i++) {
      //const row = tableData.value[i]

      // Check time and group changes
      if (hasRowTimesChanged(i) || hasRowGroupsChanged(i)) {
        return true
      }

      // Check concept value changes
      for (const conceptId in conceptData.value) {
        if (hasValueChanged(i, conceptId)) {
          return true
        }
      }
    }

    return false
  })

  // The rows can be laid out again while no change waits to be saved or is being saved: changes are kept by row
  const canChangeRowMode = computed(() =>
    !hasUnsavedChanges.value && !isSubmitting.value && Object.keys(activeSubmissions.value).length === 0
  )

  const setRowMode = (mode) => {
    if (mode === rowMode.value || !canChangeRowMode.value) return
    const entries = entriesFromTable()
    rowMode.value = mode
    layout(entries)
  }

  /**
   * Prepare updates for a specific dataset
   */
  const prepareDatasetUpdates = (datasetId) => {
    const updates = []
    const indexMapping = [] // Maps submission index -> table row index
    const conceptId = Object.keys(conceptData.value).find(cid =>
      conceptData.value[cid].datasetIds.includes(datasetId)
    )

    if (conceptId == null) return { updates, indexMapping, conceptId: null }

    const concept = conceptData.value[conceptId]?.concept

    for (let i = 0; i < tableData.value.length; i++) {
      const row = tableData.value[i]
      const cellKey = `${row._rowId}-${conceptId}`
      const metadata = cellMetadata.value[cellKey]

      if (!metadata || metadata.datasetId !== datasetId) continue
      if (metadata.recordId == null) continue // No existing record
      if (isMarkedForDeletion(i, conceptId)) continue // Will be deleted

      const valueChanged = hasValueChanged(i, conceptId)
      const timesChanged = hasRowTimesChanged(i)
      const groupsChanged = hasRowGroupsChanged(i)

      if (valueChanged || timesChanged || groupsChanged) {
        const update = { id: metadata.recordId, ...recordTimes(row, metadata) }
        // Only send groups when changed (full set for the record)
        if (groupsChanged) {
          update.groups = buildGroupsInput(row, datasetId)
        }
        // For complex scales, include referenceIds instead of value
        if (concept && isComplexScale(concept)) {
          update.referenceIds = cellReferences.value[cellKey].map(reference => reference.id) || []
          update.value = null
        } else {
          update.value = row[`concept_${conceptId}`] ?? null
        }
        updates.push(update)
        indexMapping.push(i) // Track the original row index
      }
    }
    return { updates, indexMapping, conceptId }
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
          datasetsWithChanges.add(datasetId)
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

      // Check contributors
      for (const datasetId in datasetContributors.value) {
        if (hasContributorsChanged(datasetId)) {
          datasetsWithChanges.add(datasetId)
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
            clearDeletedRecords(datasetId, deletions)
          }

          // Then, handle updates to records and contributors in one submission
          const { updates, indexMapping, conceptId } = prepareDatasetUpdates(datasetId)
          const contributions = hasContributorsChanged(datasetId)
            ? datasetContributors.value[datasetId].contributions.map(({ personId, roleIds }) => ({ personId, roleIds: [...(roleIds ?? [])] }))
            : null
          if (updates.length > 0 || contributions) {
            const result = await updateDataset({
              id: datasetId,
              records: updates,
              ...(contributions ? { contributions } : {})
            })

            if (result?.status === 'SUCCESS' || result?.result) {
              // Start polling for submission status
              const submissionId = result.result
              if (submissionId) {
                // Store the mapping for error handling when polling completes
                pendingSubmissions.value[datasetId] = { indexMapping, conceptId, updates, contributions }
                startSubmissionPolling(datasetId, submissionId)
              }
            } else {
              throw new Error(result?.errors?.[0]?.message || 'Update failed')
            }
          } else if (deletions && deletions.size > 0) {
            // Only deletions, no updates
            columnStatus.value[datasetId] = { status: 'success' }
            lastSavedAt.value = new Date()
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

  // The saved values become the baseline, so the table can stay open and show nothing left to save
  const rebaselineUpdates = ({ updates, indexMapping, conceptId }) => {
    (updates ?? []).forEach((update, k) => {
      const row = tableData.value[indexMapping?.[k]]
      if (!row) return
      const meta = rowMetadata.value[row._rowId]
      if (meta) {
        // the row's times as shown, which for a row by period are not its records' own
        meta.originalStart = rowTime(row.startTime)
        meta.originalEnd = rowTime(row.endTime)
        meta.originalGroups = Object.fromEntries(groupingColumns.value.map((c) => [c.key, normalizeCode(row[c.key])]))
      }
      const cellKey = `${row._rowId}-${conceptId}`
      const cell = cellMetadata.value[cellKey]
      if (!cell) return
      cell.start = update.start
      cell.end = update.end
      if (update.referenceIds) {
        cell.originalReferences = (cellReferences.value[cellKey] ?? []).map((reference) => reference.id)
      } else {
        cell.originalValue = update.value
      }
    })
  }

  // Removed records leave empty cells with nothing to save
  const clearDeletedRecords = (datasetId, recordIds) => {
    for (const [cellKey, cell] of Object.entries(cellMetadata.value)) {
      if (cell.datasetId !== datasetId || !recordIds.has(cell.recordId)) continue
      const rowId = cellKey.slice(0, cellKey.lastIndexOf('-'))
      const conceptId = cellKey.slice(cellKey.lastIndexOf('-') + 1)
      const row = tableData.value.find((r) => r._rowId === rowId)
      if (row) row[`concept_${conceptId}`] = ''
      delete cellMetadata.value[cellKey]
      delete cellReferences.value[cellKey]
    }
    delete recordsToDelete.value[datasetId]
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
      const { indexMapping, conceptId, updates, contributions } = pending || {}

      if (status === 'COMPLETED') {
        // The saved contributors are the new baseline
        if (contributions && datasetContributors.value[datasetId]) {
          datasetContributors.value[datasetId].original = contributionsKey(contributions)
        }
        rebaselineUpdates({ updates, indexMapping, conceptId })
        if (updates && updates.length > 0) {
              updates.forEach(update => {
                const cacheUpdate = {
                  id: update.id,
                  value: update.value,
                  start: update.start,
                  end: update.end
                }
                if (update.groups) {
                  cacheUpdate.groups = update.groups.map((g) => ({ __typename: 'RecordGroup', ...g }))
                }
                updateRecordInCache(cacheUpdate)
              })
            }


        columnStatus.value[datasetId] = { status: 'success' }
        lastSavedAt.value = new Date()
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

  // The rows to export: as shown, but with a row that stands for a period split by its records' own times, so an export
  // keeps every record's time whatever the view
  const exportRows = () => tableData.value.flatMap((row) => {
    if (row._period == null) return [row]
    const byTime = new Map()
    for (const conceptId of Object.keys(conceptData.value)) {
      const metadata = cellMetadata.value[`${row._rowId}-${conceptId}`]
      if (!metadata) continue
      const key = `${metadata.start ?? ''}\u0000${metadata.end ?? ''}`
      if (!byTime.has(key)) {
        const split = { ...row, _period: null, startTime: metadata.start ?? '', endTime: metadata.end ?? '' }
        Object.keys(conceptData.value).forEach((id) => { split[`concept_${id}`] = '' })
        describeUnit(split)
        byTime.set(key, split)
      }
      byTime.get(key)[`concept_${conceptId}`] = row[`concept_${conceptId}`] ?? ''
    }
    return [...byTime.values()].sort(compareRows)
  })

  /**
   * Export visible data as CSV
   */
  const exportToCSV = (visibleColumns, filename = 'dataset_curation.csv') => {
    const rows = exportRows()
    if (rows.length === 0) return

    // Build header row
    const headers = visibleColumns.map(col => col.header || col.id)

    // Build data rows
    const csvRows = [headers.join(',')]

    rows.forEach(row => {
      const values = visibleColumns.map(col => {
        const applied = appliedConceptId(col.id)
        let value = (applied ? getAppliedFactor(row, applied)?.value : row[col.id]) ?? ''
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
  const updateCellReferences = (rowIndex, conceptId, references) => {
    const row = tableData.value[rowIndex]
    if (!row) return

    const cellKey = `${row._rowId}-${conceptId}`
    cellReferences.value[cellKey] = references || []
    validateCellReferences(rowIndex, conceptId)
  }

  /**
   * A record on a complex scale cites at least one file, so one left with none is refused when saved: its last file
   * goes with the record, deleted instead
   */
  const validateCellReferences = (rowIndex, conceptId) => {
    const row = tableData.value[rowIndex]
    const errorKey = `${rowIndex}-concept_${conceptId}`
    delete cellErrors.value[errorKey]
    if (!row || !cellHasRecord(rowIndex, conceptId) || isMarkedForDeletion(rowIndex, conceptId)) return
    if ((cellReferences.value[`${row._rowId}-${conceptId}`] ?? []).length === 0) {
      cellErrors.value[errorKey] = { message: 'A record on a complex scale cites at least one file: delete the record instead' }
    }
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
    datasetContributors.value = {}
    recordsToDelete.value = {}
    columnStatus.value = {}
    cellErrors.value = {}
    cellReferences.value = {}
    pendingSubmissions.value = {}
    groupingColumns.value = []
    datasetStudyIds.value = {}

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
    datasetContributors,
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
    refreshControllers,
    updateCell,
    validateCell,
    getCellError,
    markRecordForDeletion,
    unmarkRecordForDeletion,
    isMarkedForDeletion,
    hasValueChanged,
    hasRowTimesChanged,
    // How records are laid out in rows, and their times
    rowMode,
    canChangeRowMode,
    setRowMode,
    isTimeCellEditable,
    getCellTime,
    setUnitDetails,
    // Factors applied to variable rows
    appliedFactors,
    appliedKey,
    getAppliedFactor,
    lastSavedAt,
    hasRowGroupsChanged,
    getCellReferences,
    updateCellReferences,
    hasContributorsChanged,
    canEditContributors,
    setContributors,
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
    // Groupings
    groupingColumns,
    rowSections,
    isGroupingKey,
    isGroupCellEditable,
    getGroupValueOptions,
    getRowSectionKey,
    getRowSectionLabel,
  }
}