// The tables of a descriptive statistics result (DescriptiveResultView): one for each term described, in the order the
// result gives them, its row over all observations first, then one for each combination of levels. A continuous
// term's columns are its statistics; an ordinal term's, e.g. a disease score, are its quantiles, each a category, and
// how many observations fell in each category, with their share: it has no mean, which would take the steps between
// categories as equal. Imports nothing from Vue or the app, so the unit tests can load it.

export const CONTINUOUS_COLUMNS = [
  ['count', 'n'],
  ['missingCount', 'Missing'],
  ['mean', 'Mean'],
  ['standardDeviation', 'SD'],
  ['standardError', 'SE'],
  ['minimum', 'Min'],
  ['lowerQuartile', 'Q1'],
  ['median', 'Median'],
  ['upperQuartile', 'Q3'],
  ['maximum', 'Max']
]

export const ORDINAL_COLUMNS = [
  ['count', 'n'],
  ['missingCount', 'Missing'],
  ['minimum', 'Min'],
  ['lowerQuartile', 'Q1'],
  ['median', 'Median'],
  ['upperQuartile', 'Q3'],
  ['maximum', 'Max']
]

/**
 * The result's terms as tables: [{ term, ordinal, columns, categories, rows }], rows the overall first. keyOf(term)
 * tells terms apart; categories are an ordinal term's, in its order, for a column each
 */
export function descriptiveTables (terms, keyOf) {
  const tables = new Map()
  for (const row of terms) {
    const key = keyOf(row.term)
    if (!tables.has(key)) {
      const ordinal = Boolean(row.ordinal)
      tables.set(key, {
        term: row.term,
        ordinal,
        columns: ordinal ? ORDINAL_COLUMNS : CONTINUOUS_COLUMNS,
        categories: ordinal ? row.ordinal.categories.map((category) => category.level) : [],
        overall: [],
        others: []
      })
    }
    tables.get(key)[row.levels.length === 0 ? 'overall' : 'others'].push(row)
  }
  return [...tables.values()].map(({ overall, others, ...table }) => ({ ...table, rows: [...overall, ...others] }))
}

/** A row's value in a column: an ordinal term's quantiles are categories, under ordinal */
export const columnValue = (row, key) => (row.ordinal && !['count', 'missingCount'].includes(key) ? row.ordinal[key] : row[key])

/** How many observations of a row fell in a category, with their share: "4 (50%)" */
export function categoryCount (row, level) {
  const category = row.ordinal?.categories.find((c) => c.level === level)
  if (!category) return '—'
  return category.share == null ? String(category.count) : `${category.count} (${Math.round(category.share * 100)}%)`
}
