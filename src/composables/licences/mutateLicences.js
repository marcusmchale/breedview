import { useApolloClient, useMutation } from '@vue/apollo-composable'
import ACCEPT_LICENCES from '@/graphql/licences/acceptLicences.graphql'

// Accept study licences, each at the text read (breedgraph licencesAccept): the API keeps the acceptance in a cookie
export function useAcceptLicences () {
  const { resolveClient } = useApolloClient()
  const { mutate, loading } = useMutation(ACCEPT_LICENCES)

  const acceptLicences = async (licences) => {
    const response = await mutate({ licences: licences.map(({ id, contentHash }) => ({ id, contentHash })) })
    const payload = response?.data?.licencesAccept
    if (payload?.status === 'SUCCESS') {
      // whether each is accepted is read again wherever it is shown
      const cache = resolveClient().cache
      licences.forEach(({ id }) => cache.evict({ id: cache.identify({ __typename: 'LegalReference', id }), fieldName: 'accepted' }))
      cache.gc()
    }
    return { status: payload?.status ?? 'ERROR', errors: payload?.errors ?? [{ message: 'The licences could not be accepted' }] }
  }

  return { acceptLicences, loading }
}
