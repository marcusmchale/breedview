import { ApolloClient, createHttpLink, InMemoryCache } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { useCsrf } from '../composables/useCsrf'

const graphqlUri = `${process.env.VUE_APP_API_HOST}${process.env.VUE_APP_GRAPHQL_PATH}`

const httpLink = createHttpLink({
  uri: graphqlUri,
  credentials: 'include', // Important for cookies
})

// eslint-disable-next-line no-unused-vars
const authLink = setContext(async (_, { headers }) => {
  const { csrfToken, fetchCsrfToken } = useCsrf()

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

const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
  },
})

export default apolloClient