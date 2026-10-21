<!-- src/components/references/LegalText.vue: a legal reference's text, such as a licence, rendered when written as
     markdown and shown as written otherwise, with the file it was read from when it was given as one -->
<script setup>
import { computed } from 'vue'
import { renderMarkdown } from '@/composables/system/markdown'
import FileDownloadButton from '@/components/references/FileDownloadButton.vue'

const props = defineProps({
  // a LegalReference: text, textFormat, and filename and fileId when given as a file
  reference: {
    type: Object,
    required: true
  }
})

const html = computed(() => (props.reference.textFormat === 'MARKDOWN' ? renderMarkdown(props.reference.text ?? '') : null))
</script>

<template>
  <div class="legal-text">
    <!-- renderMarkdown escapes everything it is given -->
    <div v-if="html !== null" class="text-content markdown" v-html="html"></div>
    <div v-else class="text-content plain">{{ reference.text }}</div>
    <div v-if="reference.fileId" class="original-file">
      <span>Read from <strong>{{ reference.filename }}</strong></span>
      <FileDownloadButton :file-id="reference.fileId" :filename="reference.filename" size="small" />
    </div>
  </div>
</template>

<style scoped>
.text-content {
  background: white;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  font-size: 0.9em;
  max-height: 24em;
  overflow-y: auto;
}

.plain {
  white-space: pre-wrap;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3),
.markdown :deep(h4),
.markdown :deep(h5),
.markdown :deep(h6) {
  font-size: 1em;
  margin: 0.8em 0 0.4em;
}

.markdown :deep(p),
.markdown :deep(ul),
.markdown :deep(ol) {
  margin: 0.4em 0;
}

.original-file {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 0.85em;
  color: #555;
}
</style>
