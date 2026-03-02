<script setup>
import { ref, computed, watch, markRaw } from 'vue';
import { useApolloClient } from '@vue/apollo-composable';
import { useMutateReferences } from '@/composables/references/mutateReferences';
import { useReferenceSchema } from '@/composables/references/useReferenceSchema';
import { useRecentFileReferencesQuery } from '@/composables/references/recentFileReferencesQuery';
import { pollFileSubmission } from '@/composables/references/fileSubmissionQuery';

import UploadStatus from "@/components/references/UploadStatus.vue";
import FileDownloadButton from "@/components/references/FileDownloadButton.vue";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  selectedReferenceIds: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['close', 'update:selectedReferenceIds']);

const { resolveClient } = useApolloClient();
const {
    createDataFileReference,
    createDataFileReferenceError,
    createDataFileReferenceLoading,
    updateDataFileReference,
    updateDataFileReferenceError,
    updateDataFileReferenceLoading,
    deleteReferences,
    deleteReferencesError,
    deleteReferencesLoading
} = useMutateReferences();

const { dataFormats } = useReferenceSchema();
const { recentFileReferences, refetchRecentFiles } = useRecentFileReferencesQuery();

const activeTab = ref('upload');

const uploadForm = ref({
  file: null,
  description: '',
  format: '',
  schema: '',
});

const editingReference = ref(null);
const editForm = ref({
  description: '',
  format: '',
  schema: '',
  file: null,
});

const uploadStatus = ref(null);
const uploadProgress = ref(0);
const uploadErrors = ref([]);
const uploadedReferenceId = ref(null);

const selectedIds = ref([...props.selectedReferenceIds]);

const schemaError = ref('');

watch(() => props.selectedReferenceIds, (newIds) => {
  selectedIds.value = [...newIds];
});

const formatOptions = computed(() => {
  return dataFormats.value.map(fmt => ({
    value: fmt.name,
    label: fmt.name,
    description: fmt.description,
  }));
});

const selectedReferences = computed(() => {
  if (!recentFileReferences.value) return [];
  return recentFileReferences.value.filter(ref => 
    selectedIds.value.includes(ref.id)
  );
});

const availableReferences = computed(() => {
  if (!recentFileReferences.value) return [];
  return recentFileReferences.value.filter(ref => 
    !selectedIds.value.includes(ref.id)
  );
});

const canSubmit = computed(() => {
  return uploadForm.value.file && 
         uploadForm.value.format && 
         !schemaError.value &&
         uploadStatus.value !== 'uploading';
});

const canUpdate = computed(() => {
  return editingReference.value &&
         !schemaError.value &&
         uploadStatus.value !== 'uploading';
});

const validateSchema = (schemaText) => {
  if (!schemaText || schemaText.trim() === '') {
    schemaError.value = '';
    return true;
  }

  try {
    JSON.parse(schemaText);
    schemaError.value = '';
    return true;
  } catch (e) {
    schemaError.value = 'Invalid JSON format';
    return false;
  }
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    uploadForm.value.file = markRaw(file);
  }
};

const handleFileInputClick = (event) => {
  event.target.value = '';
};

const handleEditFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    editForm.value.file = markRaw(file);
  }
};

const handleEditFileInputClick = (event) => {
  event.target.value = '';
};

const handleSchemaInput = (value) => {
  uploadForm.value.schema = value;
  validateSchema(value);
};

const handleEditSchemaInput = (value) => {
  editForm.value.schema = value;
  validateSchema(value);
};

const resetUploadForm = () => {
  uploadForm.value = {
    file: null,
    description: '',
    format: '',
    schema: '',
  };
  uploadStatus.value = null;
  uploadProgress.value = 0;
  uploadErrors.value = [];
  uploadedReferenceId.value = null;
};

const startFilePolling = (fileId) => {
  console.log('start file polling')
  const client = resolveClient();
  console.log('client is:', client)
  const { startPolling } = pollFileSubmission({
    client,
    fileId,
    onUpdate: ({ status, progress }) => {
      console.log('polling ongoing', { status, progress });
      if (status) uploadStatus.value = status.toLowerCase();
      if (progress !== undefined) uploadProgress.value = progress;
    },
    onComplete: ({ referenceId, status, errors }) => {
      console.log('polling complete', { referenceId, status, errors });
      if (status === 'COMPLETED') {
        uploadStatus.value = 'success';
        uploadedReferenceId.value = referenceId;
        
        if (referenceId && !selectedIds.value.includes(referenceId)) {
          selectedIds.value.push(referenceId);
        }
        
        refetchRecentFiles();
        
        setTimeout(() => {
          resetUploadForm();
        }, 2000);
      } else {
        uploadStatus.value = 'error';
        uploadErrors.value = errors || ['Upload failed'];
      }
    },
  });
  
  startPolling();
};

const handleUpload = async () => {
  if (!canSubmit.value) return;

  uploadStatus.value = 'uploading';
  uploadErrors.value = [];

  try {
      const { result: fileId, status, errors } = await createDataFileReference({
          file: uploadForm.value.file,
          description: uploadForm.value.description || null,
          format: uploadForm.value.format,
          schema: uploadForm.value.schema || null,
      });
      if ( status === "SUCCESS") {
          uploadStatus.value = status
          startFilePolling(fileId);
      } else {
        if (errors && errors.length > 0) {
          uploadErrors.value = errors
        } else {
          uploadErrors.value = ['Failed to create reference. Please try again']
        }
      }
  } catch (error) {
    uploadStatus.value = 'error';
    uploadErrors.value = [error.message || 'Upload failed'];
  }
};

const startEditing = (reference) => {
  editingReference.value = reference;
  editForm.value = {
    description: reference.description || '',
    format: reference.format || '',
    schema: reference.schema || '',
    file: null,
  };
};

const cancelEditing = () => {
  editingReference.value = null;
  editForm.value = {
    description: '',
    format: '',
    schema: '',
    file: null,
  };
};

const handleUpdate = async () => {
  if (!canUpdate.value || !editingReference.value) return;

  uploadStatus.value = 'uploading';
  uploadErrors.value = [];

  try {
    const { result: fileId, status, errors } = await updateDataFileReference({
      referenceId: editingReference.value.id,
      description: editForm.value.description || null,
      format: editForm.value.format,
      schema: editForm.value.schema || null,
      file: editForm.value.file || null,
    });
    if (status === "SUCCESS") {
      uploadStatus.value = status
      startFilePolling(fileId)
    } else {
      if (errors && errors.length > 0) {
        uploadErrors.value = errors
      } else {
        uploadErrors.value = ['Failed to create reference. Please try again']
      }
    }

  } catch (error) {
    uploadStatus.value = 'error';
    uploadErrors.value = [error.message || 'Upload failed'];
  }
};

const toggleSelection = (referenceId) => {
  const index = selectedIds.value.indexOf(referenceId);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  } else {
    selectedIds.value.push(referenceId);
  }
};

const removeFromSelection = (referenceId) => {
  const index = selectedIds.value.indexOf(referenceId);
  if (index > -1) {
    selectedIds.value.splice(index, 1);
  }
};

const handleDeleteReference = async (referenceId) => {
  try {
    await deleteReferences([referenceId]);
    removeFromSelection(referenceId);
    await refetchRecentFiles();
  } catch (error) {
    console.error('Delete failed:', error);
  }
};

const handleSave = () => {
  emit('update:selectedReferenceIds', selectedIds.value);
  emit('close');
};

const handleClose = () => {
  selectedIds.value = [...props.selectedReferenceIds];
  emit('close');
};

watch(() => props.visible, (visible) => {
  if (visible) {
    refetchRecentFiles();
    resetUploadForm();
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-container">
        <div class="modal-header">
          <h2>Manage Data File References</h2>
          <button class="close-btn" @click="handleClose">&times;</button>
        </div>

        <div class="tabs">
          <button 
            :class="['tab', { active: activeTab === 'upload' }]"
            @click="activeTab = 'upload'"
          >
            Upload New File
          </button>
          <button 
            :class="['tab', { active: activeTab === 'select' }]"
            @click="activeTab = 'select'"
          >
            Select Existing ({{ availableReferences.length }})
          </button>
          <button 
            :class="['tab', { active: activeTab === 'selected' }]"
            @click="activeTab = 'selected'"
          >
            Selected ({{ selectedIds.length }})
          </button>
        </div>

        <div class="modal-content">
          <!-- Upload Tab -->
          <div v-if="activeTab === 'upload'" class="tab-content">
            <div class="form-group">
              <label>File *</label>
              <input 
                type="file"
                @click="handleFileInputClick"
                @change="handleFileSelect"
                :disabled="uploadStatus === 'uploading'"
              />
              <span v-if="uploadForm.file" class="file-name">
                {{ uploadForm.file.name }}
              </span>
            </div>

            <div class="form-group">
              <label>Description</label>
              <textarea 
                v-model="uploadForm.description"
                rows="3"
                placeholder="Optional description of the file"
                :disabled="uploadStatus === 'uploading'"
              />
            </div>

            <div class="form-group">
              <label>Format *</label>
              <select 
                v-model="uploadForm.format"
                :disabled="uploadStatus === 'uploading'"
              >
                <option value="">-- Select Format --</option>
                <option 
                  v-for="fmt in formatOptions" 
                  :key="fmt.value"
                  :value="fmt.value"
                >
                  {{ fmt.label }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label>Schema (JSON)</label>
              <textarea 
                :value="uploadForm.schema"
                @input="handleSchemaInput($event.target.value)"
                rows="4"
                placeholder='Optional JSON schema, e.g. {"type": "object", ...}'
                :disabled="uploadStatus === 'uploading'"
                :class="{ error: schemaError }"
              />
              <span v-if="schemaError" class="error-text">{{ schemaError }}</span>
            </div>
            <UploadStatus
                :uploadStatus="uploadStatus"
                :uploadProgress="uploadProgress"
                :uploadedReferenceId="uploadedReferenceId"
                :uploadErrors="uploadErrors"
            />
            <button 
              class="btn btn-primary"
              @click="handleUpload"
              :disabled="!canSubmit"
            >
              Upload File
            </button>
          </div>

          <!-- Select Existing Tab -->
          <div v-if="activeTab === 'select'" class="tab-content">
            <div v-if="availableReferences.length === 0" class="empty-state">
              No available file references. Upload a new file to get started.
            </div>
            <div v-else class="reference-list">
              <div 
                v-for="ref in availableReferences" 
                :key="ref.id"
                class="reference-item"
              >
                <div class="reference-header">
                  <input 
                    type="checkbox" 
                    :checked="selectedIds.includes(ref.id)"
                    @change="toggleSelection(ref.id)"
                  />
                  <strong>{{ ref.filename || 'Unnamed File' }}</strong>
                  <span class="reference-id">ID: {{ ref.id }}</span>
                  <FileDownloadButton
                    v-if="ref.fileId"
                    :file-id="ref.fileId"
                    :filename="ref.filename"
                    size="small"
                  />
                </div>
                <div class="reference-details">
                  <p v-if="ref.description" class="description">{{ ref.description }}</p>
                  <div class="meta">
                    <span><strong>Format:</strong> {{ ref.format }}</span>
                    <span v-if="ref.schema"><strong>Schema:</strong> Yes</span>
                  </div>
                </div>
                <div class="reference-actions">
                  <button 
                    class="btn-small btn-primary"
                    @click="toggleSelection(ref.id)"
                  >
                    {{ selectedIds.includes(ref.id) ? 'Deselect' : 'Select' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Selected Tab -->
          <div v-if="activeTab === 'selected'" class="tab-content">
            <div v-if="selectedReferences.length === 0" class="empty-state">
              No references selected. Select from existing files or upload a new one.
            </div>
            <div v-else class="reference-list">
              <div 
                v-for="ref in selectedReferences" 
                :key="ref.id"
                class="reference-item selected"
              >
                <template v-if="editingReference?.id !== ref.id">
                  <div class="reference-header">
                    <strong>{{ ref.filename || 'Unnamed File' }}</strong>
                    <span class="reference-id">ID: {{ ref.id }}</span>
                  </div>
                  <div class="reference-details">
                    <p v-if="ref.description" class="description">{{ ref.description }}</p>
                    <div class="meta">
                      <span><strong>Format:</strong> {{ ref.format }}</span>
                      <span v-if="ref.schema"><strong>Schema:</strong> Yes</span>
                    </div>
                  </div>
                  <div class="reference-actions">
                    <FileDownloadButton
                      v-if="ref.fileId"
                      :file-id="ref.fileId"
                      :filename="ref.filename"
                      size="small"
                    />
                    <button 
                      class="btn-small btn-secondary"
                      @click="startEditing(ref)"
                    >
                      Edit
                    </button>
                    <button 
                      class="btn-small btn-warning"
                      @click="removeFromSelection(ref.id)"
                    >
                      Remove
                    </button>
                    <button 
                      class="btn-small btn-danger"
                      @click="handleDeleteReference(ref.id)"
                    >
                      Delete
                    </button>
                  </div>
                </template>

                <!-- Edit Mode -->
                <template v-else>
                  <div class="edit-form">
                    <div class="form-group">
                      <label>Description</label>
                      <textarea 
                        v-model="editForm.description"
                        rows="2"
                      />
                    </div>

                    <div class="form-group">
                      <label>Format *</label>
                      <select v-model="editForm.format">
                        <option value="">-- Select Format --</option>
                        <option 
                          v-for="fmt in formatOptions" 
                          :key="fmt.value"
                          :value="fmt.value"
                        >
                          {{ fmt.label }}
                        </option>
                      </select>
                    </div>

                    <div class="form-group">
                      <label>Schema (JSON)</label>
                      <textarea 
                        :value="editForm.schema"
                        @input="handleEditSchemaInput($event.target.value)"
                        rows="3"
                        :class="{ error: schemaError }"
                      />
                      <span v-if="schemaError" class="error-text">{{ schemaError }}</span>
                    </div>

                    <div class="form-group">
                      <label>Replace File (optional)</label>
                      <input 
                        type="file"
                        @click="handleEditFileInputClick"
                        @change="handleEditFileSelect"
                      />
                      <span v-if="editForm.file" class="file-name">
                        {{ editForm.file.name }}
                      </span>
                    </div>
                    <UploadStatus
                        :uploadStatus="uploadStatus"
                        :uploadProgress="uploadProgress"
                        :uploadedReferenceId="uploadedReferenceId"
                        :uploadErrors="uploadErrors"
                    />
                    <div class="edit-actions">
                      <button 
                        class="btn-small btn-primary"
                        @click="handleUpdate"
                        :disabled="!canUpdate"
                      >
                        Save
                      </button>
                      <button 
                        class="btn-small btn-secondary"
                        @click="cancelEditing"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="handleClose">
            Cancel
          </button>
          <button class="btn btn-primary" @click="handleSave">
            Save Selection ({{ selectedIds.length }} files)
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: white;
  border-radius: 8px;
  width: 90vw;
  max-width: 800px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
}

.close-btn:hover {
  color: #333;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 24px;
}

.tab {
  padding: 12px 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  color: #333;
}

.tab.active {
  color: #2196f3;
  border-bottom-color: #2196f3;
}

.modal-content {
  flex: 1;
  overflow: auto;
  padding: 24px;
}

.tab-content {
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #333;
}

.form-group input[type="file"],
.form-group input[type="text"],
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-group textarea {
  resize: vertical;
  font-family: monospace;
}

.form-group textarea.error {
  border-color: #f44336;
}

.file-name {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  color: #666;
}

.error-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #f44336;
}

.upload-status {
  margin: 20px 0;
  padding: 16px;
  border-radius: 4px;
  background: #f5f5f5;
}

.status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status .spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #2196f3;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.status.success {
  color: #4caf50;
}

.status.error {
  color: #f44336;
  flex-direction: column;
  align-items: flex-start;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}

.progress-fill {
  height: 100%;
  background: #2196f3;
  transition: width 0.3s;
}

.error-list {
  margin: 8px 0 0 0;
  padding-left: 20px;
  font-size: 13px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
  font-style: italic;
}

.reference-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reference-item {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 16px;
  transition: border-color 0.2s;
}

.reference-item:hover {
  border-color: #2196f3;
}

.reference-item.selected {
  background: #f0f8ff;
  border-color: #2196f3;
}

.reference-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.reference-header input[type="checkbox"] {
  width: 18px;
  height: 18px;
}

.reference-header strong {
  flex: 1;
  color: #333;
}

.reference-id {
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 2px 8px;
  border-radius: 4px;
}

.reference-details {
  margin: 8px 0;
}

.description {
  margin: 0 0 8px 0;
  color: #666;
  font-size: 14px;
}

.meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
}

.reference-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.edit-form {
  padding: 12px;
  background: #fafafa;
  border-radius: 4px;
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid #e0e0e0;
}

.btn {
  padding: 10px 20px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #2196f3;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #1976d2;
}

.btn-secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background: #eee;
}

.btn-small {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  font-weight: 500;
}

.btn-small.btn-warning {
  background: #ff9800;
  color: white;
}

.btn-small.btn-warning:hover {
  background: #f57c00;
}

.btn-small.btn-danger {
  background: #f44336;
  color: white;
}

.btn-small.btn-danger:hover {
  background: #d32f2f;
}

</style>
