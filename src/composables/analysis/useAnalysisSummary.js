import { ref } from 'vue'
import { useApolloClient } from '@vue/apollo-composable'
import SUMMARY_DATASETS_QUERY from '@/graphql/analysis/analysisSummaryDatasets.graphql'
import { analysisTypeLabel, termKey, TERM_TYPE_LABELS } from '@/composables/analysis/useAnalysisForm'
import {
  datasetConcepts,
  datasetName,
  groupLabel,
  levelsLabel,
  studyName,
  subjectName,
  termLabel
} from '@/composables/analysis/useAnalysisNames'
import { analysisSettings, resultTables } from '@/composables/analysis/summaryTables'
import { summaryReport } from '@/composables/analysis/summaryReport'
import { toCsv } from '@/composables/system/csv'
import { zipStored } from '@/composables/system/zip'

/**
 * An analysis's summary, downloaded as one zip: summary.html, a printable report of its data and their studies'
 * licences, its settings, messages, result tables and charts; analysis.json, its settings in full as submitted; and a
 * CSV of each result table at full precision. Made in the browser from the submission as the page holds it, with the
 * names the page has read, so the API is asked only for the datasets' licences.
 */
export function useAnalysisSummary() {
  const { resolveClient } = useApolloClient()
  const preparing = ref(false)
  const summaryError = ref(null)

  async function downloadSummary(submission, chartsRoot = null) {
    preparing.value = true
    summaryError.value = null
    try {
      const { data } = await resolveClient().query({
        query: SUMMARY_DATASETS_QUERY,
        variables: { datasetIds: submission.datasetIds }
      })
      const read = new Map((data?.datasets?.result ?? []).filter(Boolean).map((d) => [d.id, d]))
      const datasets = submission.datasetIds.map((id) => {
        const studyId = read.get(id)?.studyId ?? datasetConcepts[id]?.studyId
        return {
          name: datasetName(id),
          study: studyId ? studyName(studyId) : '',
          licence: read.get(id)?.licence?.description ?? null
        }
      })

      const labels = { termLabel, levelsLabel, groupLabel, termKey }
      const tables = resultTables(submission.result, submission.config, labels)
      const csvs = tables.map((table) => ({
        name: `${table.file}.csv`,
        data: toCsv(table.columns.map((c) => c.label), table.rows)
      }))
      const settings = JSON.stringify(withoutTypenames({
        id: submission.id,
        name: submission.name,
        analysisType: submission.analysisType,
        datasetIds: submission.datasetIds,
        exclusions: submission.exclusions,
        config: submission.config
      }), null, 2)

      const generated = new Date()
      const type = analysisTypeLabel(submission.analysisType)
      const report = summaryReport({
        title: submission.name || `${type} analysis`,
        generated,
        site: new URL(import.meta.env.BASE_URL || '/', window.location.origin).href,
        analysis: { id: submission.id, type },
        datasets,
        settings: analysisSettings(submission, {
          termLabel,
          analysisTypeLabel,
          termTypeLabel: (termType) => TERM_TYPE_LABELS[termType] ?? termType,
          subjectName
        }),
        errors: (submission.errors ?? []).map((m) => m.message),
        warnings: (submission.warnings ?? []).map((m) => m.message),
        tables,
        charts: chartsIn(chartsRoot),
        files: ['summary.html', 'analysis.json', ...csvs.map((f) => f.name)]
      })

      const bytes = zipStored([
        { name: 'summary.html', data: report },
        { name: 'analysis.json', data: settings },
        ...csvs
      ], generated)
      save(new Blob([bytes], { type: 'application/zip' }), `analysis-${submission.id}-${slug(submission.analysisType)}.zip`)
    } catch (error) {
      console.error('The analysis summary could not be prepared:', error)
      summaryError.value = error.message || 'The summary could not be prepared'
    } finally {
      preparing.value = false
    }
  }

  return { downloadSummary, preparing, summaryError }
}

const slug = (text) => String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const withoutTypenames = (value) => JSON.parse(JSON.stringify(value, (key, v) => (key === '__typename' ? undefined : v)))

// The result's charts as the page drew them, as SVG standing alone: the fonts and text sizes the page's styles gave
// them are set on the copies, which are coloured by their own attributes
function chartsIn(root) {
  if (!root) return []
  return [...root.querySelectorAll('svg[role="img"]')].map((svg) => {
    const copy = svg.cloneNode(true)
    copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const style = getComputedStyle(svg)
    copy.setAttribute('style', `font-family: ${style.fontFamily}; font-size: ${style.fontSize}`)
    const copies = copy.querySelectorAll('text')
    svg.querySelectorAll('text').forEach((text, i) => {
      const textStyle = getComputedStyle(text)
      copies[i].setAttribute('font-size', textStyle.fontSize)
      if (!copies[i].getAttribute('fill')) copies[i].setAttribute('fill', textStyle.fill)
    })
    return copy.outerHTML
  })
}

function save(blob, filename) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // revoked once the browser has the file
  setTimeout(() => URL.revokeObjectURL(link.href), 10000)
}
