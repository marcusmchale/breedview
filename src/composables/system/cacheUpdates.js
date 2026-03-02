import {useApolloClient} from "@vue/apollo-composable";
import {toHaveSuspenseCacheEntryUsing} from "@apollo/client/testing/matchers/toHaveSuspenseCacheEntryUsing";

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

export function useCacheUpdates({ typename, fragment }) {

    const { resolveClient} = useApolloClient()
    const client = resolveClient()

    const getCached = ({itemId}) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: itemId
        })
        return client.cache.readFragment({
            id: itemCacheId,
            fragment: fragment
        })
    }

    const deleteItem = ({itemId}) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: itemId
        })
        const cachedData = getCached({id: itemCacheId})
        if (cachedData?.parent?.id) {
            removeChildFromParentInCache({
                oldParentId: cachedData.parent?.id,
                childId: itemId
            })
        }
        client.cache.evict({ id: itemCacheId})
        client.cache.gc()
    }

    const updateOntologyEntryLifecycle = (entryId, versionId, phase) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: entryId,
            versionId: versionId,
            draft: true
        })

        console.log('itemCacheId:', itemCacheId)
        const cachedData = client.cache.readFragment({
            id: itemCacheId,
            fragment: fragment
        })
        console.log('cachedData', cachedData)
        client.cache.modify({
            id: itemCacheId,
            fields: {
                phase() {
                    return phase
                }
            }
        })
        const cachedData2 = client.cache.readFragment({
            id: itemCacheId,
            fragment: fragment
        })
        console.log('cachedData after update', cachedData2)
    }

    // takes the data to update (object)
    // the field (key in the data) that provides the ID of the item
    const updateItem = ({ updateData, idField }) => {
        // Convert field values to modifier functions
        const fieldModifiers = {};
        for (const key in updateData) {
            if (updateData[key] !== undefined && key !== idField) {
                fieldModifiers[key] = () => updateData[key];
            }
        }
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: updateData[idField]
        })
        const cachedData = client.cache.readFragment({
            id: itemCacheId,
            fragment: fragment
        })
        client.cache.modify({
            id: itemCacheId,
            fields: fieldModifiers,
        });

        updateParentIds(updateData, cachedData, idField)
        updateLocationId(updateData, cachedData, idField)
        updateTypeId(updateData, cachedData, idField)
        updateGermplasmId(updateData, cachedData, idField)

    }

    const updateParentIds = (updateData, cachedData, idField) => {
         // now update the children list in old parent if we have a new parentId
        if (updateData.parentId && updateData.parentId !== cachedData?.parent?.id) {
            changeParent({
                childId: updateData[idField],
                oldParentId: cachedData?.parent?.id,
                newParentId: updateData.parentId
            })
        }
        // Alternatively we may have a list of parentIds to update,
        // this is better handled with removal of old parentIds and creation of new refs
        else if (updateData.parentIds) {
            const cachedParentIds = cachedData?.parents.map(u => u.id)
            if (!arraysAreEqual(updateData.parentIds, cachedParentIds)) {
                const toAdd = updateData.parentIds.filter(id => !cachedParentIds.includes(id))
                console.log('toAdd:', toAdd)
                toAdd.forEach(id => {
                    addChildToParentInCache({
                        newParentId: id,
                        childId: updateData[idField],
                    })
                })

                const toRemove = cachedParentIds.filter(id => !updateData.parentIds.includes(id))
                console.log('toRemove:', toRemove)
                toRemove.forEach(id => removeChildFromParentInCache({
                    oldParentId: id,
                    childId: updateData[idField],
                }))
                console.log('Updating parent references for item:', updateData[idField], 'with parentIds:', updateData.parentIds)
                updateParentsRef({childId: updateData[idField], parentIds: updateData.parentIds})
            }
        }
    }

    const updateLocationId = (updateData, cachedData, idField) => {
        // if idField is not locationId this is another item like a layout that has a location reference
        // update this if it has changed
        if (idField !== "locationId" && updateData.locationId && updateData.locationId !== cachedData?.location?.id) {
            updateLocationRef({itemId: updateData[idField], locationId: updateData.locationId})
            if (typename === 'Layout') {
                updateLocationArrangements({
                    itemId: updateData[idField],
                    oldLocationId: cachedData?.location?.id,
                    newLocationId: updateData.locationId
                })
            }
        }
    }

    const updateTypeId = (updateData, cachedData, idField) => {
        //  here is an assumption here that the typelabel will be a concatenation of typename and Type
        // it works for layout and location, which is currently all that have typeId on their create/update fields
        if (updateData.typeId && updateData.typeId !== cachedData?.type?.id) {
            updateTypeRef({
                itemId:updateData[idField],
                typeId:updateData.typeId,
                typeLabel: `${typename}Type`
            })
        }
    }

    const updateGermplasmId = (updateData, cachedData, idField) => {
        if (updateData.germplasmId && updateData.germplasmId !== cachedData?.germplasm?.id) {
            updateGermplasmRef({
                itemId:updateData[idField],
                germplasmId:updateData.germplasmId
            })
        }
    }

    const changeParent = ({childId, oldParentId, newParentId}) => {
        removeChildFromParentInCache({
            oldParentId: oldParentId,
            childId: childId
        })
        addChildToParentInCache( {
            newParentId: newParentId,
            childId: childId
        })
        updateParentRef({
            childId: childId,
            parentId: newParentId
        })

    }

    const removeChildFromParentInCache = ({oldParentId, childId}) => {
        const oldParentCacheId = client.cache.identify({
            __typename: typename,
            id: oldParentId
        })
        const childCacheId = client.cache.identify({
            __typename: typename,
            id: childId
        })
        client.cache.modify({
            id: oldParentCacheId,
            fields: {
                children(existingChildren = []) {
                    return existingChildren.filter(
                        ref => ref.__ref !== childCacheId
                    );
                }
            }
        })
    }

    const addChildToParentInCache = ({newParentId, childId}) => {
        // now update the new parent in the cache
        const newParentCacheId = client.cache.identify({
            __typename: typename,
            id: newParentId
        })
        const childCacheId = client.cache.identify({
            __typename: typename,
            id: childId
        })
        console.log('creating entry for child',childId, ' in parent', newParentId)
        client.cache.modify({
            id: newParentCacheId,
            fields: {
                children(existingChildren = []) {
                    return [...existingChildren.filter(ref => ref.__ref !== childCacheId),  {__ref: childCacheId}];
                }
            }
        })
    }

    const updateParentRef = ({childId, parentId}) => {
        const newParentCacheId = client.cache.identify({
            __typename: typename,
            id: parentId
        })
        const childCacheId = client.cache.identify({
            __typename: typename,
            id: childId
        })
        client.cache.modify({
            id: childCacheId,
            fields: {
                parent() {
                    return {__ref: newParentCacheId};
                }
            }
        })
    }

    const updateParentsRef = ({childId, parentIds}) => {
        const newParentCacheIds = parentIds.map(parentId => client.cache.identify({
            __typename: typename,
            id: parentId
        }))
        const childCacheId = client.cache.identify({
            __typename: typename,
            id: childId
        })
        client.cache.modify({
            id: childCacheId,
            fields: {
                parents() {
                    return newParentCacheIds.map(newParentCacheId => ({__ref: newParentCacheId}));
                }
            }
        })
    }

    const updateLocationRef = ({itemId, locationId}) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: itemId
        })
        const newLocationId = client.cache.identify({
            __typename: "Location",
            id: locationId
        })
        client.cache.modify({
            id: itemCacheId,
            fields: {
                location() {
                    return {__ref: newLocationId}
                }
            }
        })
    }

    const updateLocationArrangements = ({itemId, oldLocationId, newLocationId}) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: itemId
        })
        const oldLocationArrangementsFieldname = `arrangements({"locationId":${oldLocationId}})`
        const newLocationArrangementsFieldname = `arrangements({"locationId":${newLocationId}})`
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

    const updateTypeRef = ({itemId, typeId, typeLabel}) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: itemId
        })
        const newTypeId = client.cache.identify({
            __typename: typeLabel,
            id: typeId,
        })
        client.cache.modify({
            id: itemCacheId,
            fields: {
                type() {
                    return {__ref: newTypeId}
                }
            }
        })
    }

    const updateGermplasmRef = ({itemId, germplasmId}) => {
        const itemCacheId = client.cache.identify({
            __typename: typename,
            id: itemId
        })
        const newGermplasmId = client.cache.identify({
            __typename: "Germplasm",
            id: germplasmId
        })
        client.cache.modify({
            id: itemCacheId,
            fields: {
                germplasm() {
                    return {__ref: newGermplasmId}
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

    return {
        getCached,

        updateItem,
        deleteItem,

        addPosition,
        removePosition,

        updateOntologyEntryLifecycle
    }
}