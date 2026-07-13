import { ref, onUnmounted } from 'vue'
import { useLazyQuery, useMutation } from '@vue/apollo-composable'

import FILE_DOWNLOAD_STATE from "@/graphql/references/fileDownloadState.graphql"
import FILE_DOWNLOAD from "@/graphql/references/fileDownload.graphql"
import REQUEST_FILE_RETRIEVAL from "@/graphql/references/requestFileRetrieval.graphql"

const POLL_INTERVAL_MS = 3000

// phase: 'idle' | 'checking' | 'requesting' | 'retrieving' | 'ready' | 'failed'
export function useReferencesFileDownloadLazy() {
  const phase = ref('idle')
  const progress = ref(null)
  const downloadUrl = ref(null)
  const expiresAt = ref(null)
  const errorMessage = ref(null)

  let currentFileId = null
  let pollingTimer = null
  let stateLoaded = false
  let downloadLoaded = false

  const { load: loadState, refetch: refetchState } = useLazyQuery(
    FILE_DOWNLOAD_STATE, null, { fetchPolicy: 'network-only' }
  )
  const { load: loadDownload, refetch: refetchDownload } = useLazyQuery(
    FILE_DOWNLOAD, null, { fetchPolicy: 'network-only' }
  )
  const { mutate: mutateRequestRetrieval } = useMutation(REQUEST_FILE_RETRIEVAL)

  const stopPolling = () => {
    if (pollingTimer) {
      clearTimeout(pollingTimer)
      pollingTimer = null
    }
  }

  // load() returns TResult directly; refetch() returns ApolloQueryResult with .data
  const queryState = async (fileId) => {
    if (!stateLoaded) {
      stateLoaded = true
      const data = await loadState(FILE_DOWNLOAD_STATE, { fileId })
      return data?.referencesFileDownloadState
    }
    const result = await refetchState({ fileId })
    return result?.data?.referencesFileDownloadState
  }

  const queryDownload = async (fileId) => {
    if (!downloadLoaded) {
      downloadLoaded = true
      const data = await loadDownload(FILE_DOWNLOAD, { fileId })
      return data?.referencesFileDownload
    }
    const result = await refetchDownload({ fileId })
    return result?.data?.referencesFileDownload
  }

  const handleAvailable = async (fileId) => {
    const payload = await queryDownload(fileId)
    if (payload?.status === 'SUCCESS' && payload?.result?.url) {
      downloadUrl.value = payload.result.url
      expiresAt.value = payload.result.expiresAt
      phase.value = 'ready'
    } else {
      phase.value = 'failed'
      errorMessage.value = payload?.errors?.[0]?.message || 'Failed to get download URL'
    }
  }

  const schedulePolling = (fileId) => {
    pollingTimer = setTimeout(async () => {
      if (currentFileId !== fileId) return
      try {
        const payload = await queryState(fileId)
        const status = payload?.result?.status
        if (status === 'AVAILABLE') {
          await handleAvailable(fileId)
        } else if (status === 'RETRIEVING') {
          progress.value = payload.result?.progress?.progress ?? null
          schedulePolling(fileId)
        } else if (status === 'FAILED') {
          phase.value = 'failed'
          errorMessage.value = 'File retrieval failed'
        } else {
          schedulePolling(fileId)
        }
      } catch {
        if (currentFileId === fileId) schedulePolling(fileId)
      }
    }, POLL_INTERVAL_MS)
  }

  const startDownload = async (fileId) => {
    if (!['idle', 'ready', 'failed'].includes(phase.value)) return
    stopPolling()
    currentFileId = fileId
    phase.value = 'checking'
    progress.value = null
    errorMessage.value = null
    downloadUrl.value = null

    try {
      const payload = await queryState(fileId)
      console.log('queryState:', payload)
      if (!payload || payload.status !== 'SUCCESS') {
        phase.value = 'failed'
        errorMessage.value = payload?.errors?.[0]?.message || 'Failed to check file state'
        return
      }
      const status = payload.result?.status
      if (status === 'AVAILABLE') {
        await handleAvailable(fileId)
      } else if (status === 'ARCHIVED') {
        phase.value = 'requesting'
        const mutateResult = await mutateRequestRetrieval({ fileId })
        const mutatePayload = mutateResult?.data?.referencesRequestFileRetrieval
        if (mutatePayload?.status === 'SUCCESS') {
          phase.value = 'retrieving'
          schedulePolling(fileId)
        } else {
          phase.value = 'failed'
          errorMessage.value = mutatePayload?.errors?.[0]?.message || 'Failed to request file retrieval'
        }
      } else if (status === 'RETRIEVING') {
        progress.value = payload.result?.progress?.progress ?? null
        phase.value = 'retrieving'
        schedulePolling(fileId)
      } else if (status === 'FAILED') {
        phase.value = 'failed'
        errorMessage.value = 'File retrieval failed'
      }
    } catch (err) {
      phase.value = 'failed'
      errorMessage.value = err.message
    }
  }

  onUnmounted(stopPolling)

  return { phase, progress, downloadUrl, expiresAt, errorMessage, startDownload }
}
