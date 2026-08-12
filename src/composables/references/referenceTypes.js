export const REFERENCE_TYPE_CONFIGS = {
    LEGAL: {
        key: 'LEGAL',
        typename: 'LegalReference',
        label: 'Legal',
        icon: '⚖️'
    },
    EXTERNAL: {
        key: 'EXTERNAL',
        typename: 'ExternalReference',
        label: 'External',
        icon:'🔗'
    },
    FILE: {
        key: 'FILE',
        typename: 'FileReference',
        label: 'File',
        icon:'📄'
    },
    EXTERNAL_DATA: {
        key: 'EXTERNAL_DATA',
        typename: 'ExternalDataReference',
        label: 'External Data',
        icon:'📊'
    },
    DATA_FILE: {
        key: 'DATA_FILE',
        typename: 'DataFileReference',
        label: 'Data File',
        icon:'📁'
    },
}

export const DATA_REFERENCE_TYPE_CONFIGS = [
    REFERENCE_TYPE_CONFIGS.EXTERNAL_DATA,
    REFERENCE_TYPE_CONFIGS.DATA_FILE
]

export const FILE_REFERENCE_TYPE_CONFIGS = [
    REFERENCE_TYPE_CONFIGS.FILE,
    REFERENCE_TYPE_CONFIGS.DATA_FILE
]

export const ENTITY_REFERENCE_TYPE_CONFIGS = [
    REFERENCE_TYPE_CONFIGS.LEGAL,
    REFERENCE_TYPE_CONFIGS.EXTERNAL,
    REFERENCE_TYPE_CONFIGS.FILE
]

export const EXTERNAL_REFERENCE_TYPE_CONFIGS = [
    REFERENCE_TYPE_CONFIGS.EXTERNAL
]

// Named groups
export const REFERENCE_TYPE_GROUPS = {
    ENTITY: ENTITY_REFERENCE_TYPE_CONFIGS,
    DATA: DATA_REFERENCE_TYPE_CONFIGS,
    LICENSE: [REFERENCE_TYPE_CONFIGS.LEGAL],
    EXTERNAL: EXTERNAL_REFERENCE_TYPE_CONFIGS,
}

const REFERENCE_TYPE_BY_TYPENAME = Object.fromEntries(
  Object.values(REFERENCE_TYPE_CONFIGS).map(config => [
    config.typename,
    config,
  ])
)

export function getReferenceTypeConfig(reference) {
  const type = getReferenceType(reference)
  return type ? REFERENCE_TYPE_BY_TYPENAME[type] ?? null : null
}

export function getReferenceType(reference) {
    if (!reference) return null
    return reference.__typename || null
}

export function getReferenceTypeIcon(reference) {
  return getReferenceTypeConfig(reference)?.icon ?? '📎'
}

export function getReferenceTypeLabel(reference) {
  return getReferenceTypeConfig(reference)?.label ?? 'Unknown'
}

export function isDataReference(reference) {
    const type = getReferenceTypeConfig(reference)
    return DATA_REFERENCE_TYPE_CONFIGS.includes(type)
}

export function isFileReference(reference) {
    const type = getReferenceTypeConfig(reference)
    return FILE_REFERENCE_TYPE_CONFIGS.includes(type)
}

export function isSelectableForEntity(reference) {
    // For Programs, Trials, Studies - exclude data references
    return !isDataReference(reference)
}

export function getReferenceTypesForGroup(groupName) {
  return REFERENCE_TYPE_GROUPS[groupName] || []
}

export function isReferenceTypeInList(reference, typeConfigs) {
  const refType = getReferenceTypeConfig(reference)
  return typeConfigs.includes(refType)
}
