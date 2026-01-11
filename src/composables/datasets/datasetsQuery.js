import { toValue } from "vue";
import { useQuery } from '@vue/apollo-composable';
import { computed } from "vue";
import DATASETS_QUERY from "@/graphql/datasets/datasets.graphql";

export function useDatasetsQuery({ datasetId, conceptId }) {
  const { result, loading, error } = useQuery(
    DATASETS_QUERY,
    () => ({
      datasetId: toValue(datasetId),
      conceptId: toValue(conceptId),
    }),
    () => ({
      enabled: !!(toValue(datasetId)) || !!(toValue(conceptId)),
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