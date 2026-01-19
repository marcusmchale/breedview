import { ref } from 'vue'
import { useQuery } from '@vue/apollo-composable'

import { ontologyLabelsMap } from './nodeColorMap'

// Introspection query for OntologyEntryLabel enum
import ONTOLOGY_LABELS_QUERY from "@/graphql/ontology/entryLabels.graphql"

export function useOntologySchema() {

    const generateLabelEntries = (enumValues) => {
        return enumValues.map(enumValue => {
          const labelConfig = ontologyLabelsMap[enumValue.name]

          if (!labelConfig) {
            console.warn(`No label config found for ${enumValue.name}`)
            return null
          }

          return {
            label: labelConfig.text,
            method: `create${labelConfig.PascalCase}`,
            description: enumValue.description || '',
            enumLabel: enumValue.name,
            color: labelConfig.color,
            code: labelConfig.code
          }
        }).filter(entry => entry !== null)
      }

  const labelEntries = ref([])

  // Query to fetch enum descriptions
  const { onResult } = useQuery(ONTOLOGY_LABELS_QUERY)

  onResult((result) => {
    const enumValues = result.data?.__type?.enumValues || []

    // Dynamically generate label entries
    labelEntries.value = generateLabelEntries(enumValues)
  })

  const getCreateEntriesForLabels = () => labelEntries
  return {
    getCreateEntriesForLabels
  }
}