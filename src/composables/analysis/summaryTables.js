// What an analysis's summary download holds (useAnalysisSummary.js): its settings, and its result as tables, each with
// a file name, a title, columns and rows of raw values, so that a CSV keeps every digit while the report formats them
// as the result views do (column formats: text, number, df, p, r, share). The names come from the caller
// (useAnalysisNames, useAnalysisForm), so this imports nothing from Vue or the app, and the unit tests can load it.
import { descriptiveTables, columnValue } from './descriptiveTables.js'

/**
 * The grouping dimensions of a configuration in words, in the editor's order, as the submission view lists them. The
 * observation unit isn't one of them (observationUnit).
 */
export function groupingDimensions (grouping) {
  if (!grouping) return []
  const out = []
  if (grouping.germplasm) {
    out.push(grouping.germplasm.germplasmIds.length ? `Germplasm (${grouping.germplasm.germplasmIds.length})` : "Germplasm (each unit's own)")
  }
  if (grouping.position) out.push(['Location', ...(grouping.position.axes ?? [])].join(', '))
  if (grouping.time) {
    out.push(`Time (${grouping.time.binning.labels?.length ?? grouping.time.binning.boundaries.length + 1} bins)`)
  }
  grouping.recordGroups.forEach((d) => out.push(`Record group: ${d.name}`))
  return out
}

/** The observation unit in words: each record's unit, or the nearest unit of the subjects */
export const observationUnit = (grouping, subjectName) => (grouping?.unit
  ? `Nearest unit of ${grouping.unit.subjectIds.map(subjectName).join(' or ')}`
  : "Each record's unit")

const lower = (text) => String(text ?? '').toLowerCase().replace(/_/g, '-')

// "Means of A × B by C", led by the response where it has one, as EstimatedMeansView titles them
function meansTitle (em, { termLabel }) {
  let text = `Means of ${em.terms.map(termLabel).join(' × ')}`
  if (em.by.length) text += ` by ${em.by.map(termLabel).join(' × ')}`
  if (em.response) text = `${termLabel(em.response)}: ${text.charAt(0).toLowerCase()}${text.slice(1)}`
  return text
}

/** The settings of a submission as [label, value] pairs, for the report */
export function analysisSettings (submission, { termLabel, analysisTypeLabel, termTypeLabel, subjectName }) {
  const config = submission.config
  const settings = [['Type', analysisTypeLabel(submission.analysisType)]]
  if (!config) return settings
  settings.push(['Terms', config.terms.map((t) =>
    `${termLabel(t.reference)}${t.reference.type === 'CONCEPT' ? '' : ` (${termTypeLabel(t.reference.type).toLowerCase()})`}`
  ).join(', ')])
  settings.push(['Observation unit', observationUnit(config.grouping, subjectName)])
  const dimensions = groupingDimensions(config.grouping)
  if (dimensions.length) settings.push(['Dimensions', dimensions.join(', ')])
  if (config.response) settings.push(['Response', termLabel(config.response)])
  if (config.sumOfSquares) settings.push(['Sums of squares', config.sumOfSquares === 'TYPE_III' ? 'Type III' : 'Type II'])
  if (config.ddf) settings.push(['Denominator df, for mixed models', lower(config.ddf)])
  if (config.alpha != null) settings.push(['α', String(config.alpha)])
  if (config.interactions?.length) {
    settings.push(['Interactions', config.interactions.map((i) => i.terms.map(termLabel).join(' × ')).join(', ')])
  }
  for (const em of config.estimatedMeans ?? []) {
    let text = meansTitle({ ...em, response: null }, { termLabel })
    if (em.contrast && em.contrast !== 'NONE') text += `, ${lower(em.contrast)} contrasts, ${lower(em.adjustment)} adjustment`
    settings.push(['Estimated means', text])
  }
  if (config.distance) settings.push(['Distance', lower(config.distance)])
  if (config.dimensions != null) settings.push(['MDS dimensions', String(config.dimensions)])
  if (config.clustering) {
    settings.push(['Clustering', `${config.clustering.method === 'KMEANS' ? 'k-means' : 'hierarchical'}, ${config.clustering.clusters} clusters`])
  }
  if (config.correlationMethod) settings.push(['Correlation', lower(config.correlationMethod)])
  if (config.outlierMethod) settings.push(['Outlier method', lower(config.outlierMethod)])
  if (submission.exclusions?.length) {
    settings.push(['Exclusions', `${submission.exclusions.length} rule${submission.exclusions.length === 1 ? '' : 's'}`])
  }
  return settings
}

const column = (label, format = 'number') => ({ label, format })

function estimatedMeansTables (estimatedMeans, labels, numbered) {
  const { levelsLabel } = labels
  return estimatedMeans.flatMap((em, i) => {
    const suffix = numbered ? `-${i + 1}` : ''
    const hasBy = em.by.length > 0
    const means = {
      file: `estimated-means${suffix}`,
      title: meansTitle(em, labels),
      columns: [
        column('Level', 'text'), ...(hasBy ? [column('Conditioned on', 'text')] : []),
        column('Mean'), column('SE'), column('df', 'df'), column('Lower confidence limit'), column('Upper confidence limit')
      ],
      rows: em.means.map((m) => [
        levelsLabel(m.levels), ...(hasBy ? [levelsLabel(m.by)] : []),
        m.mean, m.standardError, m.degreesOfFreedom, m.lowerConfidenceLimit, m.upperConfidenceLimit
      ])
    }
    if (em.contrast === 'NONE' || !em.contrasts.length) return [means]
    const contrasts = {
      file: `contrasts${suffix}`,
      title: `${meansTitle(em, labels)}: contrasts`,
      note: `${em.contrast === 'PAIRWISE' ? 'Pairwise contrasts' : 'Contrasts against the control'}, p values adjusted by ` +
        `${lower(em.adjustment)}. Significant contrasts are marked.`,
      columns: [
        column('Contrast', 'text'), ...(hasBy ? [column('Conditioned on', 'text')] : []),
        column('Estimate'), column('SE'), column('df', 'df'), column('Statistic'), column('p', 'p'),
        column('Lower confidence limit'), column('Upper confidence limit'), column('Significant', 'text')
      ],
      rows: em.contrasts.map((c) => [
        `${levelsLabel(c.levelsA)} − ${levelsLabel(c.levelsB)}`, ...(hasBy ? [levelsLabel(c.by)] : []),
        c.estimate, c.standardError, c.degreesOfFreedom, c.statistic, c.pValue,
        c.lowerConfidenceLimit, c.upperConfidenceLimit, c.significant ? 'yes' : 'no'
      ]),
      significant: em.contrasts.map((c) => Boolean(c.significant))
    }
    return [means, contrasts]
  })
}

function anovaTables (result, config, labels) {
  const { termLabel } = labels
  const alpha = config.alpha ?? 0.05
  const mixed = result.randomEffects.length > 0 ||
    [...result.terms, ...result.interactions].some((r) => r.denominatorDegreesOfFreedom != null)
  const effects = [
    ...result.terms.map((r) => ({ ...r, label: termLabel(r.term) })),
    ...result.interactions.map((r) => ({ ...r, label: r.terms.map(termLabel).join(' × ') }))
  ]
  const statistics = (r) => [
    r.degreesOfFreedom, ...(mixed ? [r.denominatorDegreesOfFreedom] : []), r.sumOfSquares, r.meanSquare, r.fStatistic, r.pValue
  ]
  const rows = effects.map((r) => [r.label, ...statistics(r)])
  const significant = effects.map((r) => r.pValue != null && r.pValue < alpha)
  if (result.residual) {
    const residual = result.residual
    rows.push(['Residual', residual.degreesOfFreedom, ...(mixed ? [null] : []), residual.sumOfSquares, residual.meanSquare, null, null])
    significant.push(false)
  }
  const tables = [{
    file: 'anova',
    title: `${mixed ? 'Linear mixed model' : 'Linear model'} of ${termLabel(config.response)}`,
    note: `${mixed ? `${lower(config.ddf)} denominator df, ` : ''}type ${config.sumOfSquares === 'TYPE_III' ? 'III' : 'II'} ` +
      `sums of squares. Terms significant at α = ${alpha} are marked. Rows are complete observations of the model terms.`,
    columns: [
      column('Term', 'text'), column('df', 'df'), ...(mixed ? [column('Denominator df', 'df')] : []),
      column('Sum of squares'), column('Mean square'), column('F'), column('p', 'p')
    ],
    rows,
    significant
  }]
  if (result.randomEffects.length) {
    tables.push({
      file: 'random-effects',
      title: 'Random effects',
      columns: [column('Group', 'text'), column('Effect', 'text'), column('Variance'), column('Std. deviation')],
      rows: result.randomEffects.map((r) => [
        termLabel(r.group), r.slope ? `Slope: ${termLabel(r.slope)}` : 'Intercept', r.variance, r.standardDeviation
      ])
    })
  }
  return tables
}

function descriptiveSummaryTables (result, labels) {
  const { termLabel, levelsLabel, termKey } = labels
  return descriptiveTables(result.terms, termKey).map((table, i) => ({
    file: `descriptive-${i + 1}`,
    title: termLabel(table.term),
    note: table.ordinal
      ? 'Ordinal: the quantiles are categories, and each category has its count and its share of the observations.'
      : null,
    columns: [
      column('Levels', 'text'),
      ...table.columns.map(([key, label]) => column(label, ['count', 'missingCount'].includes(key) ? 'df' : 'number')),
      ...table.categories.flatMap((level) => [column(`${level}: n`, 'df'), column(`${level}: share`, 'share')])
    ],
    rows: table.rows.map((row) => [
      row.levels.length ? levelsLabel(row.levels, row.group) : 'All observations',
      ...table.columns.map(([key]) => columnValue(row, key)),
      ...table.categories.flatMap((level) => {
        const category = row.ordinal?.categories.find((c) => c.level === level)
        return [category?.count ?? null, category?.share ?? null]
      })
    ])
  }))
}

/** The result's tables: [{ file, title, note, columns: [{ label, format }], rows, significant }] */
export function resultTables (result, config, labels) {
  const { termLabel, groupLabel } = labels
  switch (result?.__typename) {
    case 'AnovaResult':
      return [
        ...anovaTables(result, config, labels),
        ...estimatedMeansTables(result.estimatedMeans, labels, result.estimatedMeans.length > 1)
      ]
    case 'DescriptiveStatisticsResult':
      return [
        ...descriptiveSummaryTables(result, labels),
        ...estimatedMeansTables(result.estimatedMeans, labels, result.estimatedMeans.length > 1)
      ]
    case 'CorrelationResult':
      return [{
        file: 'correlation',
        title: `${lower(config.correlationMethod)} correlation`,
        note: 'On pairwise complete observations. A coefficient is missing when fewer than 3 observations pair up.',
        columns: [column('', 'text'), ...result.terms.map((t) => column(termLabel(t), 'r'))],
        rows: result.matrix.map((row) => [termLabel(row.term), ...row.values])
      }]
    case 'MDSResult': {
      const dimensions = Math.max(0, ...result.observations.map((o) => o.coordinates.length))
      const clustered = result.observations.some((o) => o.clusterId != null)
      return [{
        file: 'mds',
        title: 'Multidimensional scaling',
        note: `${result.observations.length} complete observations, ${lower(config.distance)} distance on standardised ` +
          'continuous terms.',
        columns: [
          column('Observation', 'text'), ...(clustered ? [column('Cluster', 'text')] : []),
          ...[...Array(dimensions).keys()].map((d) => column(`Dimension ${d + 1}`)), column('Records', 'df')
        ],
        rows: result.observations.map((o) => [
          groupLabel(o.group), ...(clustered ? [o.clusterId] : []),
          ...[...Array(dimensions).keys()].map((d) => o.coordinates[d] ?? null), o.recordIds.length
        ])
      }]
    }
    case 'OutlierDetectionResult':
      return [{
        file: 'outliers',
        title: 'Potential outliers',
        note: `${lower(config.outlierMethod)}, sorted by score, highest first.`,
        columns: [column('Observation', 'text'), column('Term', 'text'), column('Value'), column('Score')],
        rows: result.outliers.map((o) => [
          groupLabel(o.observation) || 'Observation', o.term ? termLabel(o.term) : 'All terms', o.value, o.score
        ])
      }]
    default:
      return []
  }
}
