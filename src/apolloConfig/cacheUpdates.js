import { toValue } from "vue";
import { useApolloClient } from "@vue/apollo-composable";
import { getIdentityResolver } from "@/apolloConfig/identityResolvers";

import ONTOLOGY_QUERY from '@/graphql/ontology/ontology.graphql'

function setsAreEqual(set1, set2) {
  if (set1.size !== set2.size) {
    return false;
  }
  for (let item of set1) {
    if (!set2.has(item)) {
      return false;
    }
  }
  return true;
}

function arraysAreEqual(arr1, arr2) {
  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  return setsAreEqual(set1, set2);
}

export function useCacheUpdates({ typename, fragment, ontologyVersionId, ontologyView }) {

    const { resolveClient} = useApolloClient()
    const client = resolveClient()
    const identityResolver = getIdentityResolver(typename)


    const getCached = (keyData) => {
        const identity = identityResolver(keyData)
        const itemCacheId = client.cache.identify(identity)
        return client.cache.readFragment({
            id: itemCacheId,
            fragment: fragment
        })
    }

    const deleteFromCache = (keyData) => {
        const identity = identityResolver(keyData)
        const itemCacheId = client.cache.identify(identity)
        const cachedData = getCached({id: itemCacheId})
        if (cachedData?.parent?.id) {
            // we can safely assume for complex keys (only OntologyEntry)
            // that the fields other than id should be the same, so expand these to get the correct parent
            const parentIdentity = identityResolver({...keyData, id: cachedData.parent?.id})
            const parentCacheId = client.cache.identify(parentIdentity)
            removeChildFromParentInCache({
                parentCacheId: parentCacheId,
                childCacheId: itemCacheId
            })
        }
        client.cache.evict({ id: itemCacheId})
        client.cache.gc()
    }


    function omitIdentity(obj, identity) {
        return Object.fromEntries(
        Object.entries(obj).filter(([k]) => !Object.hasOwn(identity, k))
        );
    }

    // takes the data to update (object)
    // the field (key in the data) that provides the ID of the item
    const updateCache = (updateData) => {
        const identity = identityResolver(updateData)
        const itemCacheId = client.cache.identify(identity)

        const fieldModifiers = {}
        for (const key in omitIdentity(updateData, identity)) {
            if (updateData[key] !== undefined) {
                fieldModifiers[key] = () => updateData[key]
            }
        }
        const cachedData = client.cache.readFragment({
            id: itemCacheId,
            fragment: fragment
        })
        client.cache.modify({
            id: itemCacheId,
            fields: fieldModifiers,
        });
        updateParentIds({ updateData, cachedData, itemCacheId })
        updateLocationId({ updateData, cachedData, itemCacheId })
        updateTypeId({ updateData, cachedData, itemCacheId })
        updateGermplasmId({ updateData, cachedData, itemCacheId })
        updateReferences({ updateData, cachedData, itemCacheId })
    }

    const updateParentIds = ( {updateData, cachedData, itemCacheId }) => {
         // now update the children list in old parent if we have a new parentId
        if (updateData.parentId && updateData.parentId !== cachedData?.parent?.id) {
            const oldParentIdentity = identityResolver({...updateData, id: cachedData?.parent?.id})
            const oldParentCacheId = client.cache.identify(oldParentIdentity)
            const newParentIdentity = identityResolver({...updateData, id: updateData.parentId})
            const newParentCacheId = client.cache.identify(newParentIdentity)
            changeParent({
                childCacheId: itemCacheId,
                oldParentCacheId: oldParentCacheId,
                newParentCacheId: newParentCacheId
            })
        }
        // Alternatively we may have a list of parentIds to update,
        // this is better handled with removal of old parentIds and creation of new refs
        else if (updateData.parentIds) {
            const cachedParentIds = cachedData?.parents.map(u => u.id)
            if (!arraysAreEqual(updateData.parentIds, cachedParentIds)) {
                const toAdd = updateData.parentIds.filter(id => !cachedParentIds.includes(id))
                toAdd.forEach(id => {
                    const newParentIdentity = identityResolver({...updateData, id: id})
                    const newParentCacheId = client.cache.identify(newParentIdentity)
                    addChildToParentInCache({
                        newParentId: newParentCacheId,
                        childId: itemCacheId,
                    })
                })

                const toRemove = cachedParentIds.filter(id => !updateData.parentIds.includes(id))
                toRemove.forEach((id) => {
                    const parentIdentity = identityResolver({...updateData, id: id})
                    const parentCacheId = client.cache.identify(parentIdentity)
                    removeChildFromParentInCache({
                        parentCacheId: parentCacheId,
                        childCacheId: itemCacheId,
                        })
                })

                const newParentIdentities = updateData.parentIds.map(parentId => identityResolver({...updateData, id: parentId}))
                const newParentCacheIds = newParentIdentities.map(parentId => client.cache.identify(parentId))
                updateParentsRef({
                    childCacheId: itemCacheId,
                    parentCacheIds: newParentCacheIds
                })
            }
        }
    }

    const updateLocationId = ( {updateData, cachedData, itemCacheId} ) => {
        if (updateData.locationId && updateData.locationId !== cachedData?.location?.id) {
            const locationIdentityResolver = getIdentityResolver("Location")
            const newLocationIdentity = locationIdentityResolver({id: updateData.locationId})
            const newLocationCacheId = client.cache.identify(newLocationIdentity)
            updateLocationRef({itemCacheId: itemCacheId, locationCacheId: newLocationCacheId})
            if (typename === 'Layout') {
                updateLocationArrangements({
                    itemCacheId: itemCacheId,
                    oldLocationId: cachedData?.location?.id,
                    newLocationId: updateData.locationId
                })
            }
        }
    }

    const updateTypeId = ({updateData, cachedData, itemCacheId}) => {
        // here is an assumption here that the newType typename will be a concatenation of the scoped typename and Type
        // this works for layout and location, which is currently all that have typeId on their create/update fields
        if (updateData.typeId && updateData.typeId !== cachedData?.type?.id) {
            const newTypeIdentityResolver = getIdentityResolver(`${typename}Type`)
            const newTypeIdentity = newTypeIdentityResolver({
                id: updateData.typeId,
                versionId: toValue(ontologyVersionId),
                view: ontologyView
            })
            const newTypeCacheId = client.cache.identify(newTypeIdentity)
            updateTypeRef({
                itemCacheId:itemCacheId,
                typeCacheId: newTypeCacheId

            })
        }
    }

    const updateGermplasmId = ({updateData, cachedData, itemCacheId}) => {
        if (updateData.germplasmId && updateData.germplasmId !== cachedData?.germplasm?.id) {
            const germplasmIdentityResolver = getIdentityResolver("Germplasm")
            const newGermplasmIdentity = germplasmIdentityResolver({id: updateData.germplasmId})
            const newGermplasmCacheId = client.cache.identify(newGermplasmIdentity)
            updateGermplasmRef({
                itemCacheId: itemCacheId,
                germplasmCacheId: newGermplasmCacheId
            })
        }
    }

    const changeParent = ({childCacheId, oldParentCacheId, newParentCacheId}) => {
        removeChildFromParentInCache({
            parentCacheId: oldParentCacheId,
            childCacheId: childCacheId
        })
        addChildToParentInCache( {
            parentCacheId: newParentCacheId,
            childCacheId: childCacheId
        })
        updateParentRef({
            childCacheId: childCacheId,
            parentCacheId: newParentCacheId
        })

    }

    const removeChildFromParentInCache = ({ parentCacheId, childCacheId }) => {
        client.cache.modify({
            id: parentCacheId,
            fields: {
                children(existingChildren = []) {
                    return existingChildren.filter(
                        ref => ref.__ref !== childCacheId
                    );
                }
            }
        })
    }

    const addChildToParentInCache = ({ parentCacheId, childCacheId }) => {
        client.cache.modify({
            id: parentCacheId,
            fields: {
                children(existingChildren = []) {
                    return [...existingChildren.filter(ref => ref.__ref !== childCacheId),  {__ref: childCacheId}];
                }
            }
        })
    }

    const updateParentRef = ({childCacheId, parentCacheId}) => {
        client.cache.modify({
            id: childCacheId,
            fields: {
                parent() {
                    return {__ref: parentCacheId};
                }
            }
        })
    }

    const updateParentsRef = ({childCacheId, parentCacheIds}) => {
        client.cache.modify({
            id: childCacheId,
            fields: {
                parents() {
                    return parentCacheIds.map(newParentCacheId => ({__ref: newParentCacheId}));
                }
            }
        })
    }

    const updateLocationRef = ({itemCacheId, locationCacheId}) => {
        client.cache.modify({
            id: itemCacheId,
            fields: {
                location() {
                    return {__ref: locationCacheId}
                }
            }
        })
    }

    const updateLocationArrangements = ({itemCacheId, oldLocationId, newLocationId}) => {
        const oldLocationArrangementsFieldname = `arrangements({"locationId":"${oldLocationId}"})`
        const newLocationArrangementsFieldname = `arrangements({"locationId":"${newLocationId}"})`
        client.cache.modify({
            id: 'ROOT_QUERY',
            fields: {
                [oldLocationArrangementsFieldname]: existing => {
                    if (!existing) return existing
                    return {...existing, result: existing.result.filter(ref => ref.__ref !== itemCacheId)}
                },
                [newLocationArrangementsFieldname]: (existing, {toReference}) => {
                    if (!existing) return existing
                    return {...existing, result: [...existing.result, toReference(itemCacheId)]}
                }
            }
        })
    }

    const updateTypeRef = ({itemCacheId, typeCacheId}) => {
        client.cache.modify({
            id: itemCacheId,
            fields: {
                type() {
                    return {__ref: typeCacheId}
                }
            }
        })
    }

    const updateGermplasmRef = ({itemCacheId, germplasmCacheId}) => {
        client.cache.modify({
            id: itemCacheId,
            fields: {
                germplasm() {
                    return {__ref: germplasmCacheId}
                }
            }
        })
    }

    const positionToRefs = (position) => {
        const locationCacheId = client.cache.identify({
            __typename: "Location",
            id: position.location.id
        })
        const layoutCacheId = position.layout? client.cache.identify({
                __typename: "Layout",
                id: position.layout.id
        }) : null
        return {
            __typename: "Position",
            location: { __ref: locationCacheId },
            layout: position.layout ? { __ref: layoutCacheId } : null,
            coordinates: position.coordinates || null,
            start: position.start || null,
            end: position.end || null
        }
    }

    const addPosition = ({unitId, position}) => {
        const unitCacheId = client.cache.identify({
            __typename: "Unit",
            id: unitId
        })
        const positionWithRefs = positionToRefs(position)
        client.cache.modify({
            id: unitCacheId,
            fields: {
                positions: (existing = []) => {
                    return [...existing, positionWithRefs]
                }
            }
        })
    }

    const removePosition = ({unitId, position}) => {
        const unitCacheId = client.cache.identify({
            __typename: "Unit",
            id: unitId
        })
        const positionWithRefs = positionToRefs(position)
        const positionsMatch = (p1, p2) => {
            return (
                p1.location?.__ref === p2.location?.__ref &&
                p1.layout?.__ref === p2.layout?.__ref &&
                JSON.stringify(p1.coordinates) === JSON.stringify(p2.coordinates) &&
                p1.start === p2.start &&
                p1.end === p2.end
            );
        };
        client.cache.modify({
            id: unitCacheId,
            fields: {
                positions: (existing) => {
                    if (!existing) return existing
                    const toRemoveIndex = existing.findIndex(pos => positionsMatch(pos, positionWithRefs))
                    return toRemoveIndex === -1
                        ? existing
                        : [...existing.slice(0, toRemoveIndex), ...existing.slice(toRemoveIndex + 1)]
                }
            }
        })
    }

    const insertOntologyRelationships = (relationships) => {
        client.cache.updateQuery(
            {
                query: ONTOLOGY_QUERY,
                variables: {
                    versionId: toValue(ontologyVersionId),
                    view: ontologyView
                }
            },
            (data) => {
                if (!data) return data
                const existing = data.ontology?.result?.relationships ?? []
                const map = new Map(
                  existing.map(rel => [rel.id, rel])
                )

                for (const rel of relationships) {
                  map.set(rel.id, rel)
                }

                return {
                    ...data,
                    ontology: {
                        ...data.ontology,
                        result: {
                            ...data.ontology.result,
                            relationships: [...map.values()]
                        }
                    }
                }
            }
        )
    }


    const updateReferences = ({updateData, cachedData, itemCacheId}) => {
        if (updateData.references) {
            const cachedReferenceIds = cachedData?.references.map(u => u.id)
            if (!arraysAreEqual(updateData.references, cachedReferenceIds)) {
                const referenceIdentityResolver = getIdentityResolver("Reference")
                const toAdd = updateData.references.filter(id => !cachedReferenceIds.includes(id))
                toAdd.forEach(id => {
                    const newReferenceIdentity =referenceIdentityResolver({id: id})
                    const newReferenceCacheId = client.cache.identify(newReferenceIdentity)
                    addReferenceToItemInCache({
                        referenceCacheId: newReferenceCacheId,
                        itemCacheId: itemCacheId
                    })
                })

                const toRemove = cachedReferenceIds.filter(id => !updateData.references.includes(id))
                toRemove.forEach(id => {
                    const oldReferenceIdentity =referenceIdentityResolver({id: id})
                    const oldReferenceCacheId = client.cache.identify(oldReferenceIdentity)
                    removeReferenceFromItemInCache({
                        referenceCacheId: oldReferenceCacheId,
                        itemCacheId: itemCacheId
                    })
                })
            }
        }
    }

    const addReferenceToItemInCache = ({referenceCacheId, itemCacheId}) => {
        client.cache.modify({
            id: itemCacheId,
            fields: {
                references(existingReferences = []) {
                    return [...existingReferences.filter(ref => ref.__ref !== referenceCacheId),  {__ref: referenceCacheId}];
                }
            }
        })
    }

    const removeReferenceFromItemInCache = ({referenceCacheId, itemCacheId}) => {
        client.cache.modify({
            id: itemCacheId,
            fields: {
                references(existingReferences = []) {
                    return existingReferences.filter(
                        ref => ref.__ref !== referenceCacheId
                    )
                }
            }
        })
    }

    return {
        getCached,

        updateCache,
        deleteFromCache,

        //todo consider the need for these custom handlers, prefer updateCache to handle all,

        addPosition,
        removePosition,
        insertOntologyRelationships
    }
}