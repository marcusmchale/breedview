import { useMutation } from '@vue/apollo-composable'
import SUBMIT_ANALYSIS from "@/graphql/analysis/submitAnalysis.graphql";

export function useSubmitAnalysis() {
  const { mutate: submitAnalysisMutation, loading: submitLoading, error: submitError } =
    useMutation(SUBMIT_ANALYSIS);

  const submitAnalysis = async (analysis) => {
    const result = await submitAnalysisMutation({ analysis });
    return result?.data?.analysisSubmit;
  };

  return {
    submitAnalysis,
    submitLoading,
    submitError
  };
}