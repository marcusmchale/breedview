<script setup>
import { computed } from 'vue'
import { useAnalysisEditor } from '@/composables/analysis/useAnalysisEditor'
import { termKey, toReference } from '@/composables/analysis/useAnalysisForm'
import { responseCandidates } from '@/composables/analysis/useTermRules'
import { termLabel } from '@/composables/analysis/useAnalysisNames'
import InteractionsEditor from '@/components/analysis/config/InteractionsEditor.vue'
import EstimatedMeansEditor from '@/components/analysis/config/EstimatedMeansEditor.vue'
import FieldErrors from '@/components/analysis/config/FieldErrors.vue'

const { form, data } = useAnalysisEditor()

const type = computed(() => form.analysisType)

/* ---------- ANOVA ---------- */

const candidates = computed(() => responseCandidates(form, data.conceptsById))

const setResponse = (key) => {
  const term = form.terms.find((t) => termKey(t.reference) === key)
  form.response = term ? toReference(term.reference) : null
}

const hasRandom = computed(() => form.terms.some((t) => t.effect === 'RANDOM'))

/* ---------- MDS ---------- */

const toggleClustering = (enabled) => {
  form.options.clustering = enabled ? { method: 'KMEANS', clusters: 3 } : null
}

const setNumber = (target, key, value) => {
  target[key] = value === '' ? null : Number(value)
}
</script>

<template>
  <div>
    <template v-if="type === 'ANOVA'">
      <div class="field-row">
        <div class="field">
          <label>Response</label>
          <select :value="form.response ? termKey(form.response) : ''" @change="setResponse($event.target.value)">
            <option value="">Select the response</option>
            <option v-for="t in candidates" :key="termKey(t.reference)" :value="termKey(t.reference)">
              {{ termLabel(t.reference) }}
            </option>
          </select>
          <p class="hint">A continuous concept term with no effect and no binning.</p>
          <FieldErrors path="response" prefix />
        </div>
        <div class="field">
          <label>Significance level (alpha)</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            :value="form.options.alpha"
            @change="setNumber(form.options, 'alpha', $event.target.value)"
          />
          <FieldErrors path="options.alpha" />
        </div>
        <div class="field">
          <label>Sums of squares</label>
          <select v-model="form.options.sumOfSquares">
            <option value="TYPE_III">Type III (sum-to-zero contrasts)</option>
            <option value="TYPE_II">Type II</option>
          </select>
          <FieldErrors path="options.sumOfSquares" />
        </div>
        <div class="field">
          <label>Denominator degrees of freedom</label>
          <select v-model="form.options.ddf" :disabled="!hasRandom">
            <option value="SATTERTHWAITE">Satterthwaite</option>
            <option value="KENWARD_ROGER">Kenward-Roger</option>
          </select>
          <p class="hint">
            {{ hasRandom ? 'Used by the mixed model.' : 'Only used when a term is random (mixed model).' }}
          </p>
          <FieldErrors path="options.ddf" />
        </div>
      </div>
    </template>

    <template v-else-if="type === 'CORRELATION'">
      <div class="field-row">
        <div class="field">
          <label>Method</label>
          <select v-model="form.options.correlationMethod">
            <option value="PEARSON">Pearson</option>
            <option value="SPEARMAN">Spearman</option>
            <option value="KENDALL">Kendall</option>
          </select>
          <FieldErrors path="options.correlationMethod" />
        </div>
      </div>
      <p class="hint">
        Uses pairwise complete observations; a coefficient is missing when fewer than 3 observations pair up. Ordinal
        terms are ranked by their level order.
      </p>
    </template>

    <template v-else-if="type === 'MDS'">
      <div class="field-row">
        <div class="field">
          <label>Distance</label>
          <select v-model="form.options.distance">
            <option value="EUCLIDEAN">Euclidean</option>
            <option value="MANHATTAN">Manhattan</option>
            <option value="MINKOWSKI">Minkowski (p = 3)</option>
          </select>
          <FieldErrors path="options.distance" />
        </div>
        <div class="field">
          <label>Dimensions</label>
          <input
            type="number"
            min="1"
            step="1"
            :value="form.options.dimensions"
            @change="setNumber(form.options, 'dimensions', $event.target.value)"
          />
          <FieldErrors path="options.dimensions" />
        </div>
      </div>
      <div class="field">
        <label class="inline">
          <input
            type="checkbox"
            :checked="!!form.options.clustering"
            @change="toggleClustering($event.target.checked)"
          />
          Cluster observations
        </label>
        <div v-if="form.options.clustering" class="field-row">
          <div class="field">
            <label>Method</label>
            <select v-model="form.options.clustering.method">
              <option value="KMEANS">k-means</option>
              <option value="HIERARCHICAL">Hierarchical</option>
            </select>
          </div>
          <div class="field">
            <label>Number of clusters</label>
            <input
              type="number"
              min="2"
              step="1"
              :value="form.options.clustering.clusters"
              @change="setNumber(form.options.clustering, 'clusters', $event.target.value)"
            />
          </div>
        </div>
        <FieldErrors path="options.clustering" prefix />
      </div>
      <p class="hint">
        Uses continuous terms, standardised, on complete observations; constant terms are dropped. Clusters are computed
        on the standardised data, not the MDS coordinates.
      </p>
    </template>

    <template v-else-if="type === 'OUTLIER_DETECTION'">
      <div class="field-row">
        <div class="field">
          <label>Method</label>
          <select v-model="form.options.outlierMethod">
            <option value="Z_SCORE">Z-score (|z| &gt; 3)</option>
            <option value="IQR">IQR (outside Q1 − 1.5·IQR, Q3 + 1.5·IQR)</option>
            <option value="MAHALANOBIS">Mahalanobis (χ² p &lt; 0.001, complete observations)</option>
          </select>
          <FieldErrors path="options.outlierMethod" />
        </div>
      </div>
      <p class="hint">Thresholds are fixed by the server. Outliers can be excluded from a follow-up analysis.</p>
    </template>

    <p v-else class="hint">Descriptive statistics have no model options; interactions and estimated means are optional.</p>

    <template v-if="type === 'ANOVA' || type === 'DESCRIPTIVE_STATISTICS'">
      <h4 class="subsection-title">Interactions</h4>
      <InteractionsEditor />
      <h4 class="subsection-title">Estimated means</h4>
      <EstimatedMeansEditor />
    </template>
  </div>
</template>

<style scoped>
.inline {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
}
</style>