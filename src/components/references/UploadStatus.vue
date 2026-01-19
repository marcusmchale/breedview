<script setup>

const props = defineProps({
  uploadStatus: String,
  uploadProgress: Number,
  uploadedReferenceId: Number,
  uploadErrors: Array[String]
})

</script>

<template>
<div v-if="uploadStatus" class="upload-status">
  <div v-if="uploadStatus === 'uploading'" class="status uploading">
    <div class="spinner"></div>
    <span>Uploading file...</span>
  </div>
  <div v-else-if="uploadStatus === 'processing'" class="status processing">
    <div class="spinner"></div>
    <span>Processing... {{ uploadProgress }}%</span>
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
    </div>
  </div>
  <div v-else-if="uploadStatus === 'success'" class="status success">
    <span class="icon">✅</span>
    <span>Upload successful! Reference ID: {{ uploadedReferenceId }}</span>
  </div>
  <div v-else-if="uploadStatus === 'error'" class="status error">
    <span class="icon">❌</span>
    <span>Upload failed</span>
    <ul class="error-list">
      <li v-for="(error, idx) in uploadErrors" :key="idx">{{ error }}</li>
    </ul>
  </div>
</div>
</template>

<style scoped>

</style>