import SUBMISSION_QUERY from "@/graphql/references/fileSubmission.graphql";

// For polling outside components we directly resolve the client
export function pollFileSubmission({ client, fileId,  pollInterval = 1000, onUpdate, onComplete }) {

  let intervalId = null;

  const poll = async () => {
    try {
      const { data, loading: graphqlLoading, errors: graphqlErrors } = await client.query({
        query: SUBMISSION_QUERY,
        variables: {
          fileId: fileId
        },
        fetchPolicy: 'network-only',
      });
      console.log('File submission query result:', data);

      const result = data?.referencesFileSubmission?.result;

      const status = graphqlLoading ? 'Loading' : result?.status
      const referenceId = result?.referenceId
      const errors = result?.errors || graphqlErrors
      const progress = result?.progress

      if (onUpdate) {
        onUpdate({ referenceId, status, progress });
      }

      if (status === 'COMPLETED' || status === 'FAILED') {
        stopPolling();
        if (onComplete) {
          onComplete({ referenceId, status, errors, progress });
        }
      }
    } catch (error) {
      const errors = [error]
      if (onUpdate) {
        onUpdate({ errors });
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