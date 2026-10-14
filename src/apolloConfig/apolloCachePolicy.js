import { registerTypename } from "@/apolloConfig/typenameRegistry";

function createUnionResolver(identityResolver) {
  return function resolveReference({
    data,
    toReference,
    canRead
  }) {
    const identity = identityResolver(data)

    if (!identity) {
      return undefined
    }

    const ref = toReference(identity)

    if (!ref || !canRead(ref)) {
      return undefined
    }

    return ref
  }
}

function createUnionListReadPolicy({
  idArgName = "ids",
  resolveReference
}) {
  return function read(existing, {
    args,
    toReference,
    canRead
  }) {
    const ids = args?.[idArgName]

    if (!Array.isArray(ids)) {
      return existing
    }

    const refs = []

    for (const id of ids) {
      const ref = resolveReference({
        data: {
          id,
          ...args
        },
        toReference,
        canRead
      })

      if (!ref) {
        return undefined
      }

      refs.push(ref)
    }

    return refs
  }
}

function createUnionListTrackingPolicy(idField="id") {
  return function merge(existing, incoming, { readField }) {
    incoming = incoming ?? []
    incoming.forEach((obj) => {
      const id = readField(idField, obj);
      const typename = readField("__typename", obj);
      if (id && typename) {
        registerTypename({ id, typename });
      }
    });

    return incoming;
  };
}

// Answer a by-ids query from the cache when every requested entity is already there, so that
// a component asking for one item that a bulk query just loaded (e.g. each child of an expanded
// block node) does not send its own request. The query field returns a payload around the list.
// Any id not in the cache makes the read miss, and Apollo fetches as usual.
function createPayloadByIdsReadPolicy({
  typename,
  payloadTypename,
  idArgName = "ids"
}) {
  return function read(existing, { args, toReference, canRead }) {
    if (existing !== undefined) {
      return existing
    }
    // a single-item query passes one id where the schema takes a list; GraphQL coerces it, so accept both
    const raw = args?.[idArgName]
    const ids = Array.isArray(raw) ? raw : (raw == null ? [] : [raw])
    if (ids.length === 0) {
      return undefined
    }
    const refs = []
    for (const id of ids) {
      const ref = toReference({ __typename: typename, id })
      if (!ref || !canRead(ref)) {
        return undefined
      }
      refs.push(ref)
    }
    return { __typename: payloadTypename, status: "SUCCESS", result: refs, errors: null }
  }
}

const createReplaceOnMergePolicy = (typeName, attribute) => ({
  [typeName]: {
    fields: {
      [attribute]: {
        // eslint-disable-next-line no-unused-vars
        merge(existing = [], incoming) {
          return incoming
        }
      }
    }
  }
})


export {
    createUnionResolver,
    createUnionListReadPolicy,
    createUnionListTrackingPolicy,
    createPayloadByIdsReadPolicy,
    createReplaceOnMergePolicy
}