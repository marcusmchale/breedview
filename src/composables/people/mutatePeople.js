import { toValue } from 'vue'
import { useMutation } from '@vue/apollo-composable'

import CREATE_PERSON_MUTATION from '@/graphql/people/createPerson.graphql'
import UPDATE_PERSON_MUTATION from '@/graphql/people/updatePerson.graphql'
import ERASE_PERSON_MUTATION from '@/graphql/people/erasePerson.graphql'
import SET_ONTOLOGY_CREDIT_MUTATION from '@/graphql/people/setOntologyCredit.graphql'

const noResponse = { status: 'ERROR', errors: [{ message: 'No response from server' }] }

const unwrap = (response, field) => {
  const payload = response?.data?.[field]
  return payload ? { status: payload.status, errors: payload.errors } : noResponse
}

export function useMutatePeople() {
  const { mutate: createMutation, loading: createPersonLoading } = useMutation(CREATE_PERSON_MUTATION)
  const { mutate: updateMutation, loading: updatePersonLoading } = useMutation(UPDATE_PERSON_MUTATION)
  const { mutate: eraseMutation, loading: erasePersonLoading } = useMutation(ERASE_PERSON_MUTATION)
  const { mutate: ontologyCreditMutation, loading: setOntologyCreditLoading } = useMutation(SET_ONTOLOGY_CREDIT_MUTATION)

  // personData: { name, institution, teamIds, consentAttestation }
  const createPerson = async ({ personData, controlTeamId, release }) => {
    const response = await createMutation({
      person: personData,
      controlTeamId: toValue(controlTeamId),
      release: toValue(release)
    })
    return unwrap(response, 'peopleCreatePerson')
  }

  // personData: { id, name, institution, teamIds }; an empty institution removes it
  const updatePerson = async (personData) => {
    const response = await updateMutation({ person: personData })
    return unwrap(response, 'peopleUpdatePerson')
  }

  const erasePerson = async (personId) => {
    const response = await eraseMutation({ personId })
    return unwrap(response, 'peopleErasePerson')
  }

  // The user's own linked Person, named among the ontology's contributors or no longer; only they can choose it
  const setOntologyCredit = async (listed) => {
    const response = await ontologyCreditMutation({ listed })
    return unwrap(response, 'peopleSetOntologyCredit')
  }

  return {
    createPerson,
    createPersonLoading,
    updatePerson,
    updatePersonLoading,
    erasePerson,
    erasePersonLoading,
    setOntologyCredit,
    setOntologyCreditLoading
  }
}
