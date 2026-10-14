import { useMutation } from '@vue/apollo-composable'

import START_ORCID_LINK_MUTATION from '@/graphql/people/startOrcidLink.graphql'
import COMPLETE_ORCID_LINK_MUTATION from '@/graphql/people/completeOrcidLink.graphql'
import REMOVE_ORCID_MUTATION from '@/graphql/people/removeOrcid.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

// Verified ORCID iD linking for the user's own Person, through ORCID sign-in
export function useMutateOrcid() {
  const { mutate: startMutation, loading: startOrcidLinkLoading } = useMutation(START_ORCID_LINK_MUTATION)
  const { mutate: completeMutation, loading: completeOrcidLinkLoading } = useMutation(COMPLETE_ORCID_LINK_MUTATION)
  const { mutate: removeMutation, loading: removeOrcidLoading } = useMutation(REMOVE_ORCID_MUTATION)

  // Returns { status, url, errors }: send the browser to url on success
  const startOrcidLink = async () => {
    const payload = (await startMutation())?.data?.peopleStartOrcidLink
    if (!payload) return noResponse
    return { status: payload.status, url: payload.result, errors: payload.errors }
  }

  const completeOrcidLink = async ({ code, state }) => {
    const payload = (await completeMutation({ code, state }))?.data?.peopleCompleteOrcidLink
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  const removeOrcid = async () => {
    const payload = (await removeMutation())?.data?.peopleRemoveOrcid
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    startOrcidLink,
    startOrcidLinkLoading,
    completeOrcidLink,
    completeOrcidLinkLoading,
    removeOrcid,
    removeOrcidLoading
  }
}
