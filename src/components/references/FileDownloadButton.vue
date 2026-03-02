<script setup>
import { computed } from 'vue'
import { useReferencesFileDownloadLazy } from '@/composables/references/referencesFileDownloadLazyQuery'

const props = defineProps({
    fileId: {
        type: String,
        required: true
    },
    filename: {
        type: String,
        default: 'download'
    },
    size: {
        type: String,
        default: 'normal',
        validator: (val) => ['small', 'normal'].includes(val)
    },
    iconOnly: {
        type: Boolean,
        default: false
    }
})

const { fetchDownloadUrl, getDownloadData, loadingFileId, loading: downloadLoading } = useReferencesFileDownloadLazy()

const downloadInfo = computed(() => {
    return getDownloadData(props.fileId)
})

const isLoading = computed(() => {
    return downloadLoading.value && loadingFileId.value === props.fileId
})

const handleFetchDownloadUrl = () => {
    if (props.fileId && !isLoading.value) {
        fetchDownloadUrl(props.fileId)
    }
}
</script>

<template>
    <!-- Show download link if URL is already fetched -->
    <a
        v-if="downloadInfo?.url"
        :href="downloadInfo.url"
        :download="downloadInfo.filename || filename"
        class="download-btn"
        :class="[size, { 'icon-only': iconOnly }]"
        @click.stop
        title="Download file"
    >
        <span>⬇️</span>
        <span v-if="!iconOnly">Download</span>
    </a>
    <!-- Show fetch button if URL not yet fetched -->
    <button
        v-else
        class="download-btn"
        :class="[size, { 'icon-only': iconOnly }]"
        :disabled="isLoading"
        @click.stop="handleFetchDownloadUrl"
        :title="isLoading ? 'Loading...' : 'Get download link'"
    >
        <span>{{ isLoading ? '⏳' : '🔗' }}</span>
        <span v-if="!iconOnly">{{ isLoading ? 'Loading...' : 'Get Link' }}</span>
    </button>
</template>

<style scoped>
.download-btn {
    background: transparent;
    border: 1px solid #4caf50;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #333;
}

.download-btn.small {
    padding: 4px 8px;
    font-size: 12px;
}

.download-btn.icon-only {
    padding: 4px 8px;
    font-size: 1em;
}

.download-btn:hover:not(:disabled) {
    background: #e8f5e9;
}

.download-btn:disabled {
    opacity: 0.6;
    cursor: wait;
}

a.download-btn {
    border-color: #2196f3;
    color: #2196f3;
}

a.download-btn:hover {
    background: #e3f2fd;
}
</style>