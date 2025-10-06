
import { ref } from 'vue'
import { useQuery } from '@vue/apollo-composable'
import gql from 'graphql-tag'

export function useOntologySchema() {
  // Introspection query for OntologyEntryLabel enum
  const ONTOLOGY_LABELS_QUERY = gql`
    query {
      __type(name: "OntologyEntryLabel") {
        enumValues {
          name
          description
        }
      }
    }
  `
  function screamingSnakeToPascal(str) {
      return str
        .toLowerCase()
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
    }

  function screamingSnakeToTitle(str) {
      return str
        .toLowerCase()
        .split('_')
        .filter(word => word.length > 0) // skip empty parts if there are extra underscores
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

  // Function to generate label entries dynamically
  const generateLabelEntries = (enumValues) => {
    return enumValues.map(enumValue => ({
      label: screamingSnakeToTitle(enumValue.name),
      method: `create${screamingSnakeToPascal(enumValue.name)}`,
      description: enumValue.description || ''
    }))
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