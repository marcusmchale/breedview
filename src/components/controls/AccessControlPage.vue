<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import TeamsPanel from '@/components/teams/TeamsPanel.vue'
import AffiliationRequestsPanel from '@/components/affiliations/AffiliationRequestsPanel.vue'
import TransfersPanel from './TransfersPanel.vue'
import BulkControlPanel from './BulkControlPanel.vue'
import { useAffiliationRequestsQuery } from '@/composables/teams/affiliationRequestsQuery'

// Access control: the teams and their affiliations, the requests to join teams the user administers, the control of
// many records at once, and the transfer offers to and from the user's teams. The tab is in the URL (?tab=), so links
// and emails can open one; Teams is first because the other tabs are for admins.
const TABS = [
  { key: 'teams', label: 'Teams' },
  { key: 'requests', label: 'Affiliation requests' },
  { key: 'bulk', label: 'Bulk control' },
  { key: 'offers', label: 'Transfer offers' }
]

const route = useRoute()
const router = useRouter()
const tab = computed({
  get: () => (TABS.some((t) => t.key === route.query.tab) ? route.query.tab : TABS[0].key),
  set: (key) => router.replace({ query: { ...route.query, tab: key } })
})

// counted on their tab, so an admin sees waiting requests from any tab
const { affiliationRequests } = useAffiliationRequestsQuery()
</script>

<template>
  <div class="page-container access-control-page">
    <h2>Access control</h2>

    <div class="page-tabs" role="tablist">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="page-tab"
        role="tab"
        :aria-selected="tab === t.key"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span v-if="t.key === 'requests' && affiliationRequests.length" class="tab-count">
          {{ affiliationRequests.length }}
        </span>
      </button>
    </div>

    <TeamsPanel v-if="tab === 'teams'" />
    <AffiliationRequestsPanel v-else-if="tab === 'requests'" />
    <BulkControlPanel v-else-if="tab === 'bulk'" />
    <TransfersPanel v-else />
  </div>
</template>

<style scoped>
.access-control-page {
  max-width: 1000px;
  margin: 0 auto;
}

.page-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 2px solid #dee2e6;
}

.page-tab {
  padding: 10px 18px;
  border: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  background: none;
  font-size: 1rem;
  font-weight: 500;
  color: #6c757d;
  cursor: pointer;
}

.page-tab.active {
  color: #212529;
  border-bottom-color: #4caf50;
}

.tab-count {
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 10px;
  background: #ffc107;
  color: #212529;
  font-size: 0.8rem;
  font-weight: 600;
}
</style>
