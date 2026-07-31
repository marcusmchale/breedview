// To support lookups of typename when we only know the id and union type
import unionTypes from '/src/graphql/unionTypes.json'

function createUnionsByType(unions) {
  const unionsByType = new Map()

  for (const [abstractTypename, types] of Object.entries(unions)) {
    for (const type of types) {
      if (!unionsByType.has(type)) {
        unionsByType.set(type, new Set())
      }

      unionsByType.get(type).add(abstractTypename)
    }
  }

  return unionsByType
}

const unionsByType = createUnionsByType(unionTypes)
const typenameRegistry = new Map()

function registerTypename({id, typename}) {
  const abstractTypes = unionsByType.get(typename) ?? [];
  for (const abstractTypename of abstractTypes) {
    let registry = typenameRegistry.get(abstractTypename);

    if (!registry) {
      registry = new Map();
      typenameRegistry.set(abstractTypename, registry);

    }

    if (registry.get(id) !== typename) {
      registry.set(id, typename);
    }
  }
}

function getTypename({typename, id}) {
  const lookup = typenameRegistry.get(typename)

  if (!lookup) {
    return typename
  }

  return lookup.get(id)
}

export {
    unionsByType,
    registerTypename,
    getTypename
}