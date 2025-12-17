import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { useCsrf } from '@/composables/useCsrf'

const graphqlUri = `${process.env.VUE_APP_API_HOST}${process.env.VUE_APP_GRAPHQL_PATH}`

const httpLink = createHttpLink({
  uri: graphqlUri,
  credentials: 'include', // Important for cookies
})

const { csrfToken, fetchCsrfToken, isCSRFTokenExpired, clearCsrfToken } = useCsrf()

// eslint-disable-next-line no-unused-vars
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
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (networkError && isCSRFTokenExpired(networkError)) {
    console.log('CSRF token expired, refetching...')
    clearCsrfToken()

    // Retry the operation
    return forward(operation)
  }

  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) =>
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
    )
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`)
  }
})

//the following is to allow composing from list of ids to reduce hits to the server
// apollo by default requires exact query result matching

const createCachePolicy = (typeName, fieldName, argName) => ({
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
  typePolicies: {
    ...createCachePolicy('regionsLocations', 'locationIds'),
    ...createMergeChildPolicy('Location')
  }
})


const apolloClient = new ApolloClient({
  link: errorLink.concat(authLink).concat(httpLink),
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
if (process.env.NODE_ENV === 'development') {
  window.__APOLLO_CLIENT__ = apolloClient
}

console.log('Apollo client created')
export default apolloClient