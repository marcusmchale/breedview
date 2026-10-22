import { toValue } from 'vue'
import { useApolloClient, useMutation } from '@vue/apollo-composable'

import { evictUnitsByLocation } from '@/composables/units/unitPlaces'

import ADD_CHILDREN_MUTATION from '@/graphql/units/addChildren.graphql'

/**
 * Children added to many units at once, e.g. the leaves taken from each tree of a field on one day (breedgraph README,
 * Unit): each named from a template, and with a start placed where its parent was then, from then.
 */

// {parent} is the parent's name, {subject} the children's subject and {n} each one's number among its parent's new
// children, from 1, as breedgraph fills them in
export const CHILD_NAME_TEMPLATE = '{parent} - {subject} {n}'
export const MAX_CHILDREN = 100

/** A child's name from the template, each placeholder filled in once */
export const childName = (template, parent, subject, n) => {
    const values = { parent, subject, n: String(n) }
    return template.replace(/\{(parent|subject|n)\}/g, (_, key) => values[key])
}

const failure = (error, fallback) => ({
    status: 'ERROR',
    errors: [{ message: error?.graphQLErrors?.map((e) => e.message).join(', ') || error?.message || fallback }]
})

/**
 * Adds count children of the subject to each of the parents, by id or an arrival's ({ unitIds } or { arrival }). The
 * children come back; the parents' children and the lists of units by location are read again.
 */
export function useAddChildren() {
    const { resolveClient } = useApolloClient()
    const client = resolveClient()

    const { mutate: addChildrenMutation, loading: addChildrenLoading } = useMutation(ADD_CHILDREN_MUTATION)

    const addChildren = async ({
        parents, subjectId, count, name, description, germplasmId, start, controlTeamId, release
    }) => {
        try {
            const response = await addChildrenMutation({
                parents,
                subjectId,
                count,
                // empty, they are unnamed
                name: name?.trim() || null,
                description: description || null,
                germplasmId: germplasmId || null,
                start: start || null,
                controlTeamId: toValue(controlTeamId),
                release: toValue(release)
            })
            const payload = response?.data?.unitsAddChildren
            if (!payload) return { status: 'ERROR', errors: [{ message: 'Adding the children returned no data.' }] }
            const children = payload.result ?? []
            if (payload.status === 'SUCCESS') {
                for (const parentId of new Set(children.flatMap((child) => child.parents.map((parent) => parent.id)))) {
                    client.cache.evict({ id: client.cache.identify({ __typename: 'Unit', id: parentId }), fieldName: 'children' })
                }
                evictUnitsByLocation(client.cache)
            }
            return { status: payload.status, errors: payload.errors, units: children }
        } catch (error) {
            return failure(error, 'Failed to add the children.')
        }
    }

    return { addChildren, addChildrenLoading }
}
