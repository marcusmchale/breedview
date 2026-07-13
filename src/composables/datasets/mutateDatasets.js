import { useMutation } from '@vue/apollo-composable'

import CREATE_DATASET from "@/graphql/datasets/createDataset.graphql";
import UPDATE_DATASET from "@/graphql/datasets/updateDataset.graphql";
import REMOVE_RECORDS from "@/graphql/datasets/removeRecords.graphql";

export function useMutateDatasets() {
  const { mutate: createDatasetMutation, loading: createLoading, error: createError } =
    useMutation(CREATE_DATASET);

  const { mutate: updateDatasetMutation, loading: updateLoading, error: updateError } =
    useMutation(UPDATE_DATASET);

  const { mutate: removeRecordsMutation, loading: removeLoading, error: removeError } =
    useMutation(REMOVE_RECORDS);

  const createDataset = async (dataset) => {
    const result = await createDatasetMutation({ dataset });
    return result?.data?.datasetsCreate;
  };

  const updateDataset = async (dataset) => {
    const result = await updateDatasetMutation({ dataset });
    return result?.data?.datasetsUpdate;
  };

  const removeRecords = async (datasetId, recordIds) => {
    const result = await removeRecordsMutation({ datasetId, recordIds });
    return result?.data?.datasetsRemoveRecords;
  };

  return {
    createDataset,
    createLoading,
    createError,

    updateDataset,
    updateLoading,
    updateError,

    removeRecords,
    removeLoading,
    removeError,
  };
}
