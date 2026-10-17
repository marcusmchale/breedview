import { toValue } from "vue";
import { useQuery } from '@vue/apollo-composable';
import { computed } from "vue";
import DATASETS_QUERY from "@/graphql/datasets/datasets.graphql";

const orNull = (value) => {
  const v = toValue(value)
  if (v == null || v === '') return null
  if (Array.isArray(v) && v.length === 0) return null
  return v
}

/**
 * Datasets with a page of their records. Without unitIds, start, end, offset or limit every record comes back,
 * as the analysis context needs; the curation table passes them to narrow and page through the records.
 * unitIds selects those units and everything below them, or with includeBelow false, exactly those units.
 */
export function useDatasetsQuery({ studyIds, conceptIds, datasetIds, unitIds, start, end, offset, limit, includeBelow }) {
  const { result, loading, error } = useQuery(
    DATASETS_QUERY,
    () => ({
      studyIds: toValue(studyIds),
      datasetIds: toValue(datasetIds),
      conceptIds: toValue(conceptIds),
      unitIds: orNull(unitIds),
      start: orNull(start),
      end: orNull(end),
      offset: orNull(offset),
      limit: orNull(limit),
      includeBelow: toValue(includeBelow) ?? null,
    }),
    () => ({
      enabled: !!(toValue(datasetIds)) || !!(toValue(conceptIds)) || !!(toValue(studyIds)),
      // Datasets carry their records: tens of thousands of Record objects per query with the migrated data.
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
