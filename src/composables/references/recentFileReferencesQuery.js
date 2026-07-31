import { useQuery } from '@vue/apollo-composable';
import { computed, toValue } from "vue";
import RECENT_FILES from "@/graphql/references/recentFileReferences.graphql";

export function useRecentFileReferencesQuery(referenceTypes) {
  const { result, loading, error , refetch: refetchRecentFiles } = useQuery(
      RECENT_FILES,
      { referenceTypes: toValue(referenceTypes) }
  );

  const recentFileReferences = computed(() => {
    console.log('recent file refs result:', result.value)
    return result.value?.referencesRecentFiles?.result ?? []
  });

  return {
    recentFileReferences,
    loading,
    error,
    refetchRecentFiles
  };
}