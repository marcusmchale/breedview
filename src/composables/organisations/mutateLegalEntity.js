import { useMutation } from '@vue/apollo-composable'

import DECLARE_LEGAL_ENTITY_MUTATION from '@/graphql/organisations/declareLegalEntity.graphql'
import WITHDRAW_LEGAL_ENTITY_MUTATION from '@/graphql/organisations/withdrawLegalEntity.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

export function useMutateLegalEntity() {
  const { mutate: declareMutation, loading: declareLegalEntityLoading } = useMutation(DECLARE_LEGAL_ENTITY_MUTATION)
  const { mutate: withdrawMutation, loading: withdrawLegalEntityLoading } = useMutation(WITHDRAW_LEGAL_ENTITY_MUTATION)

  // legalEntity: { legalName, privacyContact, termsVersion }
  const declareLegalEntity = async ({ teamId, legalEntity }) => {
    const response = await declareMutation({ teamId, legalEntity })
    const payload = response?.data?.organisationsDeclareLegalEntity
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  const withdrawLegalEntity = async (teamId) => {
    const response = await withdrawMutation({ teamId })
    const payload = response?.data?.organisationsWithdrawLegalEntity
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    declareLegalEntity,
    declareLegalEntityLoading,
    withdrawLegalEntity,
    withdrawLegalEntityLoading
  }
}
