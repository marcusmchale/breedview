<script setup>
import { ref, computed } from 'vue'
import ReferenceItem from './ReferenceItem.vue'

const props = defineProps({
    references: {
        type: Array,
        default: () => []
    },
    title: {
        type: String,
        default: 'References'
    }
})

const isExpanded = ref(false)

const hasReferences = computed(() => props.references && props.references.length > 0)

const toggleExpand = () => {
    isExpanded.value = !isExpanded.value
}
</script>

<template>
    <div v-if="hasReferences" class="references-display">
        <div class="references-header" @click="toggleExpand">
            <strong>{{ title }}:</strong>
            <span class="reference-count">{{ references.length }}</span>
            <span class="expand-icon">{{ isExpanded ? '▼' : '►' }}</span>
        </div>

        <div v-if="isExpanded" class="references-list">
            <ReferenceItem
                v-for="ref in references"
                :key="ref.id"
                :reference="ref"
                :selectable="false"
                :show-actions="false"
            />
        </div>
    </div>
</template>

<style scoped>
.references-display {
    margin-top: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    background: #fafafa;
}

.references-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: background 0.2s;
}

.references-header:hover {
    background: #f0f0f0;
}

.reference-count {
    background: #2196f3;
    color: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.85em;
}

.expand-icon {
    margin-left: auto;
    color: #666;
    font-size: 0.8em;
}

.references-list {
    padding: 12px;
    border-top: 1px solid #e0e0e0;
    background: white;
}
</style>