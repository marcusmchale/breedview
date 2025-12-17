import apolloClient from '../graphql/apollo'
import ACCOUNT_QUERY from '../graphql/account/account.graphql'

export async function checkAuthentication() {
  try {
    const { data } = await apolloClient.query({
      query: ACCOUNT_QUERY,
      fetchPolicy: 'no-cache'
    })

    const accountData = data?.accountsAccount
    if (!accountData) {
      return { isAuthenticated: false, error: 'No account data received' }
    }

    if (accountData.status === 'SUCCESS' && accountData.result?.user) {
      return { 
        isAuthenticated: true, 
        user: accountData.result.user,
        allowedEmails: accountData.result.allowed_emails 
      }
    } else {
      return { 
        isAuthenticated: false, 
        error: accountData.errors?.[0]?.message || 'Authentication failed' 
      }
    }
  } catch (error) {
    console.error('Authentication check failed:', error)
    return { isAuthenticated: false, error: error.message }
  }
}

export function useAuth() {
  return {
    checkAuthentication
  }
}
