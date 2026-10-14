import { useMutation } from '@vue/apollo-composable'

import DELETE_ACCOUNT_MUTATION from '@/graphql/account/deleteAccount.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

export function useMutateAccount() {
  const { mutate: deleteMutation, loading: deleteAccountLoading } = useMutation(DELETE_ACCOUNT_MUTATION)

  // Deletes the user's own account and logs them out. erasePerson also erases their linked Person.
  const deleteAccount = async ({ password, erasePerson = true }) => {
    const payload = (await deleteMutation({ password, erasePerson }))?.data?.accountsDeleteAccount
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    deleteAccount,
    deleteAccountLoading
  }
}
