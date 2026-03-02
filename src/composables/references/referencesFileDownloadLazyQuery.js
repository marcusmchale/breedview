import { useLazyQuery } from '@vue/apollo-composable';
import { ref, reactive } from "vue";

import FILE_DOWNLOAD from "@/graphql/references/fileDownload.graphql";

export function useReferencesFileDownloadLazy() {
  // Store fetched download info per fileId
  const downloadData = reactive(new Map());
  const loadingFileId = ref(null);
  let hasLoaded = false;

  const { load, refetch, loading, error, onResult } = useLazyQuery(
    FILE_DOWNLOAD,
    null,
    { fetchPolicy: 'network-only' }
  );

  onResult((queryResult) => {
    const result = queryResult?.data?.referencesFileDownload?.result;
    if (result?.url && loadingFileId.value) {
      downloadData.set(loadingFileId.value, {
        url: result.url,
        filename: result.filename,
        expiresAt: result.expiresAt
      });
    }
    loadingFileId.value = null;
  });

  const fetchDownloadUrl = async (fileId) => {
    if (!fileId || loading.value) return;

    loadingFileId.value = fileId;

    if (!hasLoaded) {
      hasLoaded = true;
      await load(FILE_DOWNLOAD, { fileId });
    } else {
      await refetch({ fileId });
    }
  };

  const getDownloadData = (fileId) => {
    return downloadData.get(fileId) || null;
  };

  return {
    fetchDownloadUrl,
    getDownloadData,
    downloadData,
    loadingFileId,
    loading,
    error
  };
}