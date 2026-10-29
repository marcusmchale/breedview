<!-- The people named among the contributors to an ontology version, by their own choice, for anyone -->
<script setup>
import { useOntologyContributorsQuery } from '@/composables/ontology/contributorsQuery'
import { orcidUrl } from '@/composables/people/personDisplay'

const props = defineProps({
  // the version, by its id; null for the current one
  versionId: { type: String, default: null }
})

const { contributors, contributorsLoading } = useOntologyContributorsQuery({ versionId: () => props.versionId })
</script>

<template>
  <div class="ontology-contributors">
    <strong>Contributors:</strong>
    <span v-if="contributorsLoading && !contributors.length" class="text-muted"> Loading…</span>
    <ul v-else-if="contributors.length" class="contributor-list">
      <li v-for="(contributor, i) in contributors" :key="i" class="contributor">
        {{ contributor.name }}<template v-if="contributor.institution">, {{ contributor.institution }}</template>
        <a v-if="contributor.orcid" :href="orcidUrl(contributor.orcid)" target="_blank" rel="noopener" class="orcid-link">
          <span class="orcid-id">iD</span>
        </a>
      </li>
    </ul>
    <span v-else class="text-muted"> none named</span>
    <p class="text-muted note">
      Everyone who adds to the ontology is credited together, as the contributors to the BreedGraph ontology. Those
      listed chose to be named too, for the versions their work is in.
    </p>
  </div>
</template>

<style scoped>
.ontology-contributors {
  font-size: 0.9em;
  margin: 0.5rem 0;
}

.contributor-list {
  display: inline;
  margin: 0;
  padding: 0;
  list-style: none;
}

.contributor {
  display: inline;
}

.contributor:not(:last-child)::after {
  content: '; ';
}

.contributor-list::before {
  content: ' ';
}

.orcid-link {
  margin-left: 4px;
  text-decoration: none;
}

.orcid-id {
  display: inline-block;
  padding: 0 4px;
  border-radius: 50%;
  background: #a6ce39;
  color: white;
  font-size: 0.75em;
  font-weight: 700;
}

.note {
  margin: 0.25rem 0 0;
  font-size: 0.9em;
}
</style>
