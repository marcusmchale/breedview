import { useQuery } from '@vue/apollo-composable';
import { computed } from "vue";
import RECENT_FILES from "@/graphql/references/recentFileReferences.graphql";

export function useRecentFileReferencesQuery() {
  const { result, loading, error , refetch: refetchRecentFiles } = useQuery(
    RECENT_FILES
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