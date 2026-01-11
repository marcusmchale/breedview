import SUBMISSION_QUERY from "@/graphql/datasets/submission.graphql";

// For polling outside components we directly resolve the client
export function pollDatasetSubmission({ client, submissionId,  pollInterval = 2000, onUpdate, onComplete }) {

  let intervalId = null;

  const poll = async () => {
    try {
      const { data, loading: graphqlLoading, errors: graphqlErrors } = await client.query({
        query: SUBMISSION_QUERY,
        variables: {
          submissionId: submissionId,
        },
        fetchPolicy: 'network-only',
      });
      console.log('Dataset submission query result:', data);

      const result = data?.datasetsSubmission?.result;

      const status = graphqlLoading ? 'Loading' : result?.status
      const datasetId = result?.datasetId
      const errors = result?.errors || graphqlErrors
      const itemErrors = result?.itemErrors
      if (onUpdate) {
        onUpdate({ status });
      }

      if (status === 'COMPLETED' || status === 'FAILED') {
        stopPolling();
        if (onComplete) {
          onComplete({ datasetId, status, errors, itemErrors });
        }
      }
    } catch (error) {
      if (onUpdate) {
        onUpdate({ submission: null, error });
      }
    }
  };

  const startPolling = () => {
    if (!intervalId) {
      poll(); // Execute immediately
      intervalId = setInterval(poll, pollInterval);
    }
  };

  const stopPolling = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return {
    startPolling,
    stopPolling,
  };
}