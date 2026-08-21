<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  entries: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['recenter-on-node'])

const searchQuery = ref('')
const searchResults = ref([])

const performSearch = () => {
  const query = searchQuery.value.toLowerCase().trim()

  if (!query) {
    searchResults.value = []
    return
  }

  const results = props.entries
    .map(entry => {
      const name = entry.name?.toLowerCase() || ''
      const description = entry.description?.toLowerCase() || ''
      const nameMatch = name.includes(query)
      const synonymMatch = entry.synonyms?.some((s) => s.toLowerCase().includes(query))
      const descriptionMatch = description.includes(query)

      let score = 0

      if (nameMatch) score += 2
      if (synonymMatch) score += 1
      if (descriptionMatch) score += 1

      return {
        ...entry,
        score,
        matched: nameMatch || descriptionMatch || synonymMatch
      }
    })
    .filter(entry => entry.matched)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  searchResults.value = results
}

const handleResultClick = (result) => {
  emit('recenter-on-node', result)
  searchQuery.value = ''
  searchResults.value = []
}
</script>

<template>
  <div class="search-box">
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search entries..."
      class="search-input"
      @input="performSearch"
    />
    <div v-if="searchResults.length > 0" class="search-results" @wheel.stop>
      <div
        v-for="result in searchResults"
        :key="result.id"
        class="search-result-item"
        @click="handleResultClick(result)"
      >
        <div class="result-name">{{ result.name }}</div>
        <div class="result-description">{{ result.description }}</div>
      </div>
    </div>
    <div v-else-if="searchQuery && searchResults.length === 0" class="search-results">
      <div class="no-results">No results found</div>
    </div>
  </div>
</template>

<style scoped>
.search-box {
  position: absolute;
  top: 16px;
  left: 16px;
  right: auto;
  width: 300px;
  opacity: 0.95;

  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);

  z-index: 10;
  pointer-events: auto;
}

.search-box:hover {
  opacity: 1;
}

.search-input {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-bottom: 1px solid #eee;
  font-size: 14px;
  outline: none;
  border-radius: 4px 4px 0 0;
}

.search-input:focus {
  background: #f9f9f9;
}

.search-results {
  max-height: 300px;
  overflow-y: auto;
  border-radius: 0 0 4px 4px;
}

.search-result-item {
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-item:hover {
  background-color: #f0f0f0;
}

.result-name {
  font-weight: 500;
  color: #333;
  font-size: 13px;
  margin-bottom: 2px;
}

.result-description {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 256px;
}

.no-results {
  padding: 12px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>