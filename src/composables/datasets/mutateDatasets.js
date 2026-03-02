import { useMutation } from '@vue/apollo-composable'

import SUBMIT_RECORDS from "@/graphql/datasets/submitRecords.graphql";
import UPDATE_RECORDS from "@/graphql/datasets/updateRecords.graphql";
import REMOVE_RECORDS from "@/graphql/datasets/removeRecords.graphql";

export function useMutateDatasets() {
  const { mutate: submitRecordsMutation, loading: submitLoading, error: submitError } =
    useMutation(SUBMIT_RECORDS);

  const { mutate: updateRecordsMutation, loading: updateLoading, error: updateError } =
    useMutation(UPDATE_RECORDS);

  const { mutate: removeRecordsMutation, loading: removeLoading, error: removeError } =
    useMutation(REMOVE_RECORDS);

  const submitRecords = async (dataset) => {
    const result = await submitRecordsMutation({ dataset });
    return result?.data?.datasetsSubmitRecords;

  };

  const updateRecords = async (dataset) => {
    const result = await updateRecordsMutation({ dataset });
    return result?.data?.datasetsUpdateRecords;
  };

  const removeRecords = async (datasetId, recordIds) => {
    const result = await removeRecordsMutation({ datasetId, recordIds });
    return result?.data?.datasetsRemoveRecords;
  };

  return {
    submitRecords,
    submitLoading,
    submitError,

    updateRecords,
    updateLoading,
    updateError,

    removeRecords,
    removeLoading,
    removeError,
  };
}