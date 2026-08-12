import { computed } from 'vue'
import { REFERENCE_TYPE_CONFIGS } from './referenceTypes'

export function useReferencesModalConfig(referenceTypeConfigs) {
  // Ensure we always have an array of type configs
  const typeConfigs = computed(() => {
    if (!referenceTypeConfigs) return []
    return Array.isArray(referenceTypeConfigs) ? referenceTypeConfigs : [referenceTypeConfigs]
  })

  // Generate tabs configuration from the provided type configs
  const tabConfigs = computed(() => {
    return typeConfigs.value.map(typeConfig => {
      // Find the full config from REFERENCE_TYPE_CONFIGS
      const fullConfig = Object.values(REFERENCE_TYPE_CONFIGS).find(
        cfg => cfg.key === typeConfig.key
      )
      return {
        id: typeConfig.key,
        label: typeConfig.label,
        icon: typeConfig.icon,
        typename: typeConfig.typename,
        key: typeConfig.key,
      }
    })
  })

  // Define tab ordering (to keep consistent across different type sets)
  const TAB_ORDER = ['LEGAL', 'EXTERNAL', 'FILE', 'EXTERNAL_DATA', 'DATA_FILE']

  // Return tabs in consistent order
  const orderedTabs = computed(() => {
    return tabConfigs.value.sort((a, b) =>
      TAB_ORDER.indexOf(a.id) - TAB_ORDER.indexOf(b.id)
    )
  })

  // Get the default active tab (first in ordered list)
  const defaultActiveTab = computed(() => {
    return orderedTabs.value[0]?.id || null
  })

  // Check if a specific type is included
  const hasType = (typeKey) => {
    return tabConfigs.value.some(tab => tab.key === typeKey)
  }

  // Get form component name for a type
  const getFormComponentForType = (typeKey) => {
    const typeConfig = Object.values(REFERENCE_TYPE_CONFIGS).find(
      cfg => cfg.key === typeKey
    )
    if (!typeConfig) return null

    // Map type keys to component names
    const componentMap = {
      LEGAL: 'LegalReferenceForm',
      EXTERNAL: 'ExternalReferenceForm',
      FILE: 'FileReferenceForm',
      EXTERNAL_DATA: 'ExternalDataReferenceForm',
      DATA_FILE: 'DataFileReferenceForm',
    }

    return componentMap[typeKey] || null
  }

  // Get typename for a type key
  const getTypenameForKey = (typeKey) => {
    const typeConfig = Object.values(REFERENCE_TYPE_CONFIGS).find(
      cfg => cfg.key === typeKey
    )
    return typeConfig?.typename || null
  }

  return {
    typeConfigs,
    tabConfigs,
    orderedTabs,
    defaultActiveTab,
    hasType,
    getFormComponentForType,
    getTypenameForKey,
  }
}