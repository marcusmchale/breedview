import { useQuery } from '@vue/apollo-composable';
import { computed, toValue } from "vue";
import RECENT_FILES from "@/graphql/references/recentFileReferences.graphql";

// The user's recently uploaded files of the given file types. Given no types, the API returns files of every type, so
// with none to show nothing is asked for.
export function useRecentFileReferencesQuery(referenceTypes) {
  const types = toValue(referenceTypes);
  const { result, loading, error , refetch: refetchRecentFiles } = useQuery(
      RECENT_FILES,
      { referenceTypes: types },
      { enabled: types.length > 0 }
  );

  const recentFileReferences = computed(() => {
    return result.value?.referencesRecentFiles?.result ?? []
  });

  return {
    recentFileReferences,
    loading,
    error,
    refetchRecentFiles
  };
}