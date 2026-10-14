import { useMutation } from '@vue/apollo-composable'

import OFFER_TRANSFER_MUTATION from '@/graphql/controls/offerTransfer.graphql'
import ACCEPT_TRANSFER_MUTATION from '@/graphql/controls/acceptTransfer.graphql'
import REJECT_TRANSFER_MUTATION from '@/graphql/controls/rejectTransfer.graphql'
import CANCEL_TRANSFER_MUTATION from '@/graphql/controls/cancelTransfer.graphql'
import RENOUNCE_CONTROL_MUTATION from '@/graphql/controls/renounceControl.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

const unwrap = (response, field) => {
  const payload = response?.data?.[field]
  return payload ? { status: payload.status, errors: payload.errors } : noResponse
}

export function useMutateTransfers() {
  const { mutate: offerMutation, loading: offerTransferLoading } = useMutation(OFFER_TRANSFER_MUTATION)
  const { mutate: acceptMutation, loading: acceptTransferLoading } = useMutation(ACCEPT_TRANSFER_MUTATION)
  const { mutate: rejectMutation, loading: rejectTransferLoading } = useMutation(REJECT_TRANSFER_MUTATION)
  const { mutate: cancelMutation, loading: cancelTransferLoading } = useMutation(CANCEL_TRANSFER_MUTATION)
  const { mutate: renounceMutation, loading: renounceControlLoading } = useMutation(RENOUNCE_CONTROL_MUTATION)

  // offer: { entities: [{ label, id }], fromTeamIds, recipientTeamId, keepFromTeams, toTeamIds?, release? }
  const offerTransfer = async (offer) =>
    unwrap(await offerMutation({ offer }), 'controlsOfferTransfer')
  const acceptTransfer = async ({ id, toTeamIds, release }) =>
    unwrap(await acceptMutation({ id, toTeamIds, release }), 'controlsAcceptTransfer')
  const rejectTransfer = async (id) =>
    unwrap(await rejectMutation({ id }), 'controlsRejectTransfer')
  const cancelTransfer = async (id) =>
    unwrap(await cancelMutation({ id }), 'controlsCancelTransfer')
  // entities: [{ label, id }], teamIds: teams giving up control where others also control the entities
  const renounceControl = async ({ entities, teamIds }) =>
    unwrap(await renounceMutation({ entities, teamIds }), 'controlsRenounceControl')

  return {
    offerTransfer,
    offerTransferLoading,
    acceptTransfer,
    acceptTransferLoading,
    rejectTransfer,
    rejectTransferLoading,
    cancelTransfer,
    cancelTransferLoading,
    renounceControl,
    renounceControlLoading
  }
}
