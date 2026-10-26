<script setup>
import { computed } from 'vue'
import { useReferencesFileDownloadLazy } from '@/composables/references/referencesFileDownloadLazyQuery'
import FileLicenceAgreement from '@/components/licences/FileLicenceAgreement.vue'

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

const {
    phase, progress, downloadUrl, errorMessage, licences, startDownload, cancelLicences
} = useReferencesFileDownloadLazy()

// asking for licences to be accepted is not busy: the button starts the download again once they are
const isActive = computed(() => !['idle', 'licence', 'ready', 'failed'].includes(phase.value))

const statusLabel = computed(() => {
    switch (phase.value) {
        case 'checking': return 'Checking...'
        case 'requesting': return 'Requesting...'
        case 'retrieving': return progress.value != null ? `Retrieving ${progress.value}%` : 'Retrieving...'
        case 'failed': return 'Retry'
        default: return 'Get Link'
    }
})

const handleClick = () => {
    if (!props.fileId || isActive.value) return
    startDownload(props.fileId)
}
</script>

<template>
    <a
        v-if="phase === 'ready'"
        :href="downloadUrl"
        class="download-btn"
        :class="[size, { 'icon-only': iconOnly }]"
        target="_blank"
        rel="noopener"
        @click.stop
        title="Download file"
    >
        <span class="btn-icon">&#x2B07;</span>
        <span v-if="!iconOnly">Download</span>
    </a>
    <button
        v-else
        class="download-btn"
        :class="[size, { 'icon-only': iconOnly, 'failed': phase === 'failed' }]"
        :disabled="isActive"
        @click.stop="handleClick"
        :title="phase === 'failed' ? (errorMessage || 'Failed — click to retry') : statusLabel"
    >
        <span class="btn-icon">{{ isActive ? '⏳' : phase === 'failed' ? '✕' : '&#x1F517;' }}</span>
        <span v-if="!iconOnly">{{ statusLabel }}</span>
        <span
            v-if="phase === 'retrieving' && progress != null && !iconOnly"
            class="progress-bar"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
        >
            <span class="progress-fill" :style="{ width: progress + '%' }"></span>
        </span>
    </button>
    <!-- the study licences of the data in the file, accepted before it is downloaded -->
    <Teleport v-if="phase === 'licence'" to="body">
        <div class="modal-overlay" @click="cancelLicences">
            <FileLicenceAgreement
                :licences="licences"
                :filename="filename"
                @accepted="startDownload(fileId)"
                @close="cancelLicences"
            />
        </div>
    </Teleport>
    <!-- why the download was refused, e.g. a study licence not accepted yet; an icon has the reason as its title -->
    <span v-if="phase === 'failed' && errorMessage && !iconOnly" class="download-error">{{ errorMessage }}</span>
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

.download-btn.failed {
    border-color: #e53935;
    color: #e53935;
}

.download-btn:hover:not(:disabled) {
    background: #e8f5e9;
}

.download-btn.failed:hover:not(:disabled) {
    background: #ffebee;
}

.download-btn:disabled {
    opacity: 0.6;
    cursor: wait;
}

a.download-btn {
    border-color: var(--brand-accent);
    color: var(--brand-accent);
}

a.download-btn:hover {
    background: var(--brand-accent-light);
}

.progress-bar {
    display: inline-block;
    width: 60px;
    height: 4px;
    background: #e0e0e0;
    border-radius: 2px;
    overflow: hidden;
    vertical-align: middle;
}

.progress-fill {
    display: block;
    height: 100%;
    background: var(--brand-accent);
    border-radius: 2px;
    transition: width 0.3s ease;
}

.download-error {
    display: block;
    margin-top: 4px;
    font-size: 12px;
    color: #a94442;
}
</style>
