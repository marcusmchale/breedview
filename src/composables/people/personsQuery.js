import { useItemsQuery } from '@/composables/queryBase/itemsBase'
import { useItemQuery } from '@/composables/queryBase/itemBase'

import PERSONS_QUERY from '@/graphql/people/persons.graphql'

export function usePersonsQuery(personIds) {
  const { items, itemsLoading, itemsError, refetchItems } = useItemsQuery({
    itemIds: personIds,
    itemsQueryGraphql: PERSONS_QUERY,
    queryName: 'peoplePeople',
    variableName: 'personIds'
  })
  return {
    persons: items,
    personsLoading: itemsLoading,
    personsError: itemsError,
    refetchPersons: refetchItems
  }
}

export function usePersonQuery(personId) {
  const { item, itemLoading, itemError, refetchItem } = useItemQuery({
    itemId: personId,
    itemsQueryGraphql: PERSONS_QUERY,
    queryName: 'peoplePeople',
    variableName: 'personIds'
  })
  return {
    person: item,
    personLoading: itemLoading,
    personError: itemError,
    refetchPerson: refetchItem
  }
}
