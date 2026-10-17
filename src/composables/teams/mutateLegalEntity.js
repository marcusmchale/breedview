import { useMutation } from '@vue/apollo-composable'

import DECLARE_LEGAL_ENTITY_MUTATION from '@/graphql/teams/declareLegalEntity.graphql'
import WITHDRAW_LEGAL_ENTITY_MUTATION from '@/graphql/teams/withdrawLegalEntity.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

export function useMutateLegalEntity() {
  const { mutate: declareMutation, loading: declareLegalEntityLoading } = useMutation(DECLARE_LEGAL_ENTITY_MUTATION)
  const { mutate: withdrawMutation, loading: withdrawLegalEntityLoading } = useMutation(WITHDRAW_LEGAL_ENTITY_MUTATION)

  // legalEntity: { legalName, privacyContact, termsVersion }
  const declareLegalEntity = async ({ teamId, legalEntity }) => {
    const response = await declareMutation({ teamId, legalEntity })
    const payload = response?.data?.teamsDeclareLegalEntity
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  const withdrawLegalEntity = async (teamId) => {
    const response = await withdrawMutation({ teamId })
    const payload = response?.data?.teamsWithdrawLegalEntity
    return payload ? { status: payload.status, errors: payload.errors } : noResponse
  }

  return {
    declareLegalEntity,
    declareLegalEntityLoading,
    withdrawLegalEntity,
    withdrawLegalEntityLoading
  }
}
