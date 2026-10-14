import { toValue } from "vue";
import { useQuery } from '@vue/apollo-composable';
import { computed } from "vue";
import DATASETS_QUERY from "@/graphql/datasets/datasets.graphql";

export function useDatasetsQuery({ studyIds, conceptIds, datasetIds }) {
  const { result, loading, error } = useQuery(
    DATASETS_QUERY,
    () => ({
      studyIds: toValue(studyIds),
      datasetIds: toValue(datasetIds),
      conceptIds: toValue(conceptIds),
    }),
    () => ({
      enabled: !!(toValue(datasetIds)) || !!(toValue(conceptIds)) || !!(toValue(studyIds)),
      // Datasets carry every record: tens of thousands of Record objects per query with the migrated data.
      // Normalising them into the Apollo cache costs seconds and hundreds of MB, and nothing reads records
      // back from the cache (curation keeps its own row state and the analysis runs on the server),
      // so these results bypass the cache.
      fetchPolicy: 'no-cache'
    })
  );

  const datasets = computed(() => result.value?.datasets?.result ?? []);
  const datasetsLoading = computed(() => loading.value);
  const datasetsError = computed(() => error.value || result.value?.datasets?.errors);

  return {
    datasets,
    datasetsLoading,
    datasetsError,
  };
}