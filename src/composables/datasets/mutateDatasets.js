import { useMutation } from '@vue/apollo-composable'
import CREATE_DATASET from "@/graphql/datasets/createDataset.graphql";
import UPDATE_DATASET from "@/graphql/datasets/updateDataset.graphql";
import ADD_RECORDS from "@/graphql/datasets/addRecords.graphql";

export function useMutateDatasets() {
  const { mutate: createDataset, loading: createLoading, error: createError } =
    useMutation(CREATE_DATASET);

  const { mutate: updateDataset, loading: updateLoading, error: updateError } =
    useMutation(UPDATE_DATASET);

  const { mutate: addRecords, loading: addRecordsLoading, error: addRecordsError } =
    useMutation(ADD_RECORDS);

  const submitCreateDataset = async (dataset) => {
    console.log('submitCreateDataset called')
    const result = await createDataset({ dataset });
    console.log('result:', result)
    return result?.data?.datasetsCreateDataset;

  };

  const submitUpdateDataset = async (dataset) => {
    console.log('submitUpdateDataset called')
    const result = await updateDataset({ dataset });
    return result?.data?.datasetsUpdateDataset;
  };

  const submitAddRecords = async (datasetId, records) => {
    console.log('submitAddRecords called')
    const result = await addRecords({ datasetId, records });
    return result?.data?.datasetsAddRecords;
  };

  return {
    submitCreateDataset,
    createLoading,
    createError,

    submitUpdateDataset,
    updateLoading,
    updateError,

    submitAddRecords,
    addRecordsLoading,
    addRecordsError,
  };
}