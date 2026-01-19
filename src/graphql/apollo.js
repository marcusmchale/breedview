import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { createUploadLink } from 'apollo-upload-client'

import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { useCsrf } from '@/composables/system/useCsrf'


const graphqlUri = `${import.meta.env.VITE_API_HOST}${import.meta.env.VITE_GRAPHQL_PATH}`

const { csrfToken, fetchCsrfToken, isCSRFTokenExpired, clearCsrfToken } = useCsrf()

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


// Add error handling for CSRF token expiration
const errorLink = onError(({  GraphQLFormattedError, NetworkError, operation, forward }) => {
  if (NetworkError && isCSRFTokenExpired(NetworkError)) {
    console.log('CSRF token expired, refetching...')
    clearCsrfToken()

    // Retry the operation
    return forward(operation)
  }

  if (GraphQLFormattedError) {
    GraphQLFormattedError.forEach(({ message, locations, path }) =>
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
    )
  }

  if (NetworkError) {
    console.error(`[Network error]: ${NetworkError}`)
  }
})


//the following is to allow composing from list of ids to reduce hits to the server
// apollo by default requires exact query result matching
const createFlatCachePolicy = (typeName, fieldName, argName) => ({
  Query: {
    fields: {
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

const cache = new InMemoryCache({
  possibleTypes:{
    ReferenceInterface: [
      'LegalReference',
      'ExternalReference',
      'FileReference',
      'ExternalDataReference',
      'DataFileReference'
    ],
  },
  typePolicies: {
    ...createFlatCachePolicy('regionsLocations', 'locationIds'),
    ...createMergeChildPolicy('Location'),
    ...createFlatCachePolicy('arrangementsLayouts', 'layoutIds'),
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