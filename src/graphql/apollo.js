import { ApolloClient, InMemoryCache } from '@apollo/client/core'
import { createUploadLink } from 'apollo-upload-client'


import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { useCsrf } from '@/composables/system/useCsrf'

import possibleTypes from './possibleTypes.json';

import { getIdentityResolver, OntologyKeyFields } from "@/apolloConfig/identityResolvers";
import { createUnionResolver, createUnionListReadPolicy, createUnionListTrackingPolicy, createPayloadByIdsReadPolicy, createReplaceOnMergePolicy, createPositionalMergePolicy} from "@/apolloConfig/apolloCachePolicy";

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
    const newToken =
      networkError.result?.headers?.['x-csrf-token'] ||
      (networkError.response?.headers?.get && networkError.response.headers.get('X-CSRF-Token'));
    if (newToken) {
      console.log('Received 403 with new CSRF token. Updating and retrying operation...');
      csrfToken.value = newToken;
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


const cache = new InMemoryCache({
  possibleTypes: possibleTypes,
  typePolicies: {
    Query: {
      fields: {
        ontologyEntries: {
          read: createUnionListReadPolicy({
            idArgName: "ids",
            resolveReference: createUnionResolver(
                getIdentityResolver("OntologyEntryUnion")
            )
          })
        },
        // units of an expanded block node are loaded in one query; each node then reads its own from the cache
        unitsUnits: {
          read: createPayloadByIdsReadPolicy({ typename: "Unit", payloadTypename: "UnitsPayload", idArgName: "ids" })
        },
      }
    },
    Ontology: {
        fields: {
          entries: {
            merge: createUnionListTrackingPolicy()
          }
        }
    },
    OntologyEntriesPayload: {
      fields: {
        result: {
          merge: createUnionListTrackingPolicy()
        }
      }
    },
    OntologyNodeInterface: {
      keyFields: OntologyKeyFields,
    },
    OntologyRelationship: {
      keyFields: OntologyKeyFields
    },
    ...createReplaceOnMergePolicy('Location', 'children'),
    ...createReplaceOnMergePolicy('Layout', 'children'),
    ...createReplaceOnMergePolicy('Scale', 'categories'),
    ...createReplaceOnMergePolicy('Category', 'scales'),
    ...createReplaceOnMergePolicy('Term', 'subjects'),
    // controllers have no id: the badge's release, the curation table's teams and the full details share one entry
    ...createPositionalMergePolicy('ControllersPayload'),
     // disable cache for RecordGroup as id is not unique per RecordGroup, it is the id of the grouping
    RecordGroup: { keyFields: false }
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