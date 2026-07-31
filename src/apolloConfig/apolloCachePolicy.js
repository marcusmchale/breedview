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
    createReplaceOnMergePolicy
}