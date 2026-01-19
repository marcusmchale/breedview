// src/composables/references/referenceTypes.js

export const REFERENCE_TYPES = {
    LEGAL: 'LegalReference',
    EXTERNAL: 'ExternalReference',
    FILE: 'FileReference',
    EXTERNAL_DATA: 'ExternalDataReference',
    DATA_FILE: 'DataFileReference'
}

export const DATA_REFERENCE_TYPES = [
    REFERENCE_TYPES.EXTERNAL_DATA,
    REFERENCE_TYPES.DATA_FILE
]

export function getReferenceType(reference) {
    if (!reference) return null
    return reference.__typename || null
}

export function isDataReference(reference) {
    const type = getReferenceType(reference)
    return DATA_REFERENCE_TYPES.includes(type)
}

export function isSelectableForEntity(reference) {
    // For Programs, Trials, Studies - exclude data references
    return !isDataReference(reference)
}

export function getReferenceTypeLabel(reference) {
    const type = getReferenceType(reference)
    switch (type) {
        case REFERENCE_TYPES.LEGAL:
            return 'Legal'
        case REFERENCE_TYPES.EXTERNAL:
            return 'External'
        case REFERENCE_TYPES.FILE:
            return 'File'
        case REFERENCE_TYPES.EXTERNAL_DATA:
            return 'External Data'
        case REFERENCE_TYPES.DATA_FILE:
            return 'Data File'
        default:
            return 'Unknown'
    }
}

export function getReferenceTypeIcon(reference) {
    const type = getReferenceType(reference)
    switch (type) {
        case REFERENCE_TYPES.LEGAL:
            return '⚖️'
        case REFERENCE_TYPES.EXTERNAL:
            return '🔗'
        case REFERENCE_TYPES.FILE:
            return '📄'
        case REFERENCE_TYPES.EXTERNAL_DATA:
            return '📊'
        case REFERENCE_TYPES.DATA_FILE:
            return '📁'
        default:
            return '📎'
    }
}