import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { createUploadLink } from 'apollo-upload-client'

import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { useCsrf } from '@/composables/system/useCsrf'

const graphqlUri = `${import.meta.env.VITE_API_HOST}${import.meta.env.VITE_GRAPHQL_PATH}`

const { csrfToken, fetchCsrfToken } = useCsrf()

const uploadLink = createUploadLink({
  uri: graphqlUri,
  credentials: 'include',
})

const authLink = setContext(async (_, { headers }) => {

  // If we don't have a token yet, fetch it
  if (!csrfToken.value) {
    await fetchCsrfToken()
  }

  return {
    headers: {
      ...headers,
      'X-CSRF-Token': csrfToken.value || '',
    }
  }
})

// the docs for apollo don't match what we get, networkError is there and error is not!
const errorLink = onError(({ networkError, operation, forward }) => {
  if (networkError && networkError.statusCode === 403) {
    console.log('csrfToken.value:', csrfToken.value)
    const newToken =
      networkError.result?.headers?.['x-csrf-token'] ||
      (networkError.response?.headers?.get && networkError.response.headers.get('X-CSRF-Token'));
    console.log('newToken', newToken)
    if (newToken) {
      console.log('Received 403 with new CSRF token. Updating and retrying operation...');
      csrfToken.value = newToken;
      console.log('csrfToken.value:', csrfToken.value)

      // Ensure the CSRF token is added to the headers for the retry request
      operation.setContext({
        headers: {
          'X-CSRF-Token': newToken, // Add CSRF token header explicitly
        },
      });

      // Retry the operation
      return forward(operation);
    }
  }

  // Log GraphQL errors if present
  if (networkError?.result?.errors) {
    networkError.result.errors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
    });
  }

  // Log network error
  if (networkError) {
    console.error('[Network error]:', networkError);
  }
});


function createInterfaceListReadPolicy({
  interfaceName,
  possibleTypesMap,
  idArgName
}) {
  return function read(existing, { args, cache }) {
    if (!args || !args[idArgName]) return existing

    const ids = args[idArgName]
    const implementingTypes = possibleTypesMap[interfaceName] || []

    const results = []
    const store = cache.extract()

    for (const id of ids) {
      let foundRef = null

      for (const typename of implementingTypes) {
        const cacheId = cache.identify({ __typename: typename, id })

        if (cacheId && store[cacheId]) {
          foundRef = { __ref: cacheId }
          break
        }
      }

      // If any ID is missing → let Apollo fetch from network
      if (!foundRef) {
        return undefined
      }

      results.push(foundRef)
    }

    return results
  }
}

const createInterfaceCachePolicy = (fieldName, interfaceName, possibleTypesMap, idArgName = 'ids') => ({
  [fieldName]: {
    read: createInterfaceListReadPolicy({
      interfaceName,
      possibleTypesMap,
      idArgName
    }),
  },
})

// The following is to allow composing from list of ids to reduce hits to the server
// apollo by default requires exact query result matching
const createFlatCachePolicy = (fieldName, argName) => ({
  [fieldName]: {
    keyArgs: false, // Ignore arguments in cache key generation
    read: (existingData, { args }) => {
      // If no data is in the cache, return undefined (will trigger a network request)
      if (!existingData) return undefined;
      const requestedIds = args[argName]; // (e.g., locationIds, layoutIds, etc.)
      // If no 'requestedIds' in query, return all data from cache
      if (!requestedIds || requestedIds.length === 0) return existingData;
      // Filter cached data based on requested IDs
      return existingData.filter(item => requestedIds.includes(item.id));
    },
  },
})

const createMergeChildPolicy = (typeName) => ({
  [typeName]: {
    fields: {
      children: {
        // eslint-disable-next-line no-unused-vars
        merge(existing = [], incoming) {
          return incoming
        }
      }
    }
  }
})

const possibleTypes = {
    ReferenceInterface: [
      'LegalReference',
      'ExternalReference',
      'FileReference',
      'ExternalDataReference',
      'DataFileReference'
    ],
    OntologyEntryInterface: [
      'Term',
      'Subject',
      'Trait',
      'Condition',
      'Scale',
      'Category',
      'ObservationMethod',
      'Variable',
      'ControlMethod',
      'Factor',
      'Event',
      'LocationType',
      'Design',
      'LayoutType'
    ]
}

const cache = new InMemoryCache({
  possibleTypes: possibleTypes,
  typePolicies: {
    Query: {
      fields: {
        ...createInterfaceCachePolicy(
            'ontologyEntries',
            'OntologyEntryInterface',
            possibleTypes,
            'entryIds'
        ),
        ...createFlatCachePolicy('regionsLocations', 'locationIds'),
        ...createFlatCachePolicy('arrangementsLayouts', 'layoutIds'),
      }
    },
    OntologyEntryInterface: {
      keyFields: ["id", "versionId", "draft"]
    },
    OntologyRelationship: {
      keyFields: ["id", "versionId"]
    },
    ...createMergeChildPolicy('Location'),
    ...createMergeChildPolicy('Layout')
  }
})


const apolloClient = new ApolloClient({
  link: authLink.concat(errorLink).concat(uploadLink),
  cache: cache,
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      fetchPolicy: 'network-only',
      errorPolicy: 'none',  // default, fail completely
    },
  },
})


// Ensure DevTools can find it
if (import.meta.env.DEV) {
  window.__APOLLO_CLIENT__ = apolloClient
}

console.log('Apollo client created')
export default apolloClient