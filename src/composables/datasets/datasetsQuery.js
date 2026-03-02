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
      enabled: !!(toValue(datasetIds)) || !!(toValue(conceptIds)) || !!(toValue(studyIds))
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