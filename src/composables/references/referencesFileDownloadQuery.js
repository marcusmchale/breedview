import { useQuery } from '@vue/apollo-composable';
import { toValue, computed } from "vue";

import FILE_DOWNLOAD from "@/graphql/references/fileDownload.graphql";

export function useReferencesFileDownloadQuery({fileId}) {

  const enabled = computed(() => {
    const fileId = toValue(fileId)
    return fileId !== null && fileId !== undefined
  })

  const variables = computed( () => ({
     fileId: toValue(fileId)
  }))

  const { result, loading, error } = useQuery(
    FILE_DOWNLOAD, variables, { enabled: enabled }
  );

  const url = computed(() => {
    return result.value?.referencesFileDownload?.result?.url
  });

  const filename = computed(() => {
    return result.value?.referencesFileDownload?.result?.filename
  });

  return {
    url,
    filename,
    loading,
    error
  };
}