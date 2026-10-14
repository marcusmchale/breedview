import { useMutation } from '@vue/apollo-composable'

import CONTACT_PERSON_MUTATION from '@/graphql/people/contactPerson.graphql'
import REMOVE_SELF_AS_CONTACT_MUTATION from '@/graphql/people/removeSelfAsContact.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

// Messaging the contacts of a Program or Trial, and stepping down as a contact
export function useMutateContacts() {
  const { mutate: contactMutation, loading: contactPersonLoading } = useMutation(CONTACT_PERSON_MUTATION)
  const { mutate: removeSelfMutation, loading: removeSelfAsContactLoading } = useMutation(REMOVE_SELF_AS_CONTACT_MUTATION)

  // entityLabel: 'PROGRAM' or 'TRIAL'. The sender's name and email are included so the contact can reply.
  const contactPerson = async ({ personId, entityLabel, entityId, subject, message }) => {
    const payload = (await contactMutation({ personId, entityLabel, entityId, subject, message }))?.data?.peopleContactPerson
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  const removeSelfAsContact = async ({ entityLabel, entityId }) => {
    const payload = (await removeSelfMutation({ entityLabel, entityId }))?.data?.peopleRemoveSelfAsContact
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    contactPerson,
    contactPersonLoading,
    removeSelfAsContact,
    removeSelfAsContactLoading
  }
}
