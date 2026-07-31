import { getTypename, unionsByType } from "@/apolloConfig/typenameRegistry";


function createIdentityResolver({
  abstractType,
  buildIdentity
}) {
  return function resolve(data) {
    const typename = getTypename({
        typename: abstractType,
        id: data.id
    })
    if (!typename) {
      return undefined
    }
    return buildIdentity({
      typename,
      data
    })
  }
}

function createKeyFieldsIdentityBuilder(fields) {
  return function buildIdentity({ typename, data }) {
    return {
      __typename: typename,
      ...Object.fromEntries(
        fields.map(field => [
          field,
          data[field]
        ])
      )
    }
  }
}

const defaultIdentityBuilder = ({ typename, data }) => ({
    __typename: typename,
    id: data.id
})

const OntologyKeyFields = ["id", "versionId", "view"]
const ontologyKeyFieldsBuilder = createKeyFieldsIdentityBuilder(OntologyKeyFields)

const defaultResolvers = new Map()

function getIdentityResolver(typename) {
    const isOntologyType = typename === "OntologyEntryUnion" || unionsByType.get(typename)?.has("OntologyEntryUnion")
    const buildIdentity = isOntologyType
        ? ontologyKeyFieldsBuilder
        : defaultIdentityBuilder

    if (!defaultResolvers.has(typename)) {
        defaultResolvers.set(
            typename,
            createIdentityResolver({
                abstractType: typename,
                buildIdentity
            })
        )
    }
    return defaultResolvers.get(typename)
}

export { getIdentityResolver, OntologyKeyFields }