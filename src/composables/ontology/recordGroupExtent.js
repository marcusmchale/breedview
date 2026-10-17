// Record group extent: whether a grouping's codes mean anything across units. Each study grouping sets its own; a
// record group type only suggests one (its defaultExtent).

export const RECORD_GROUP_EXTENT_LABELS = {
  SHARED: 'Shared',
  WITHIN_GRAPH: 'Within unit graph',
  WITHIN_UNIT: 'Within unit'
}

export const RECORD_GROUP_EXTENT_DESCRIPTIONS = {
  SHARED: 'A code names a group of many units, e.g. Batch 3 or the Lower stratum. Records of different units with the same code belong together.',
  WITHIN_GRAPH: 'A code names a group of units within one unit graph, e.g. the design blocks of a field. ' +
    'Block 1 of one field has nothing to do with Block 1 of another.',
  WITHIN_UNIT: 'A code only tells apart the readings of one unit at one time, e.g. replicate or subsample numbers. ' +
    'Replicate 1 of one tree has nothing to do with replicate 1 of another.'
}

export const RECORD_GROUP_EXTENT_HELP =
  `Shared: ${RECORD_GROUP_EXTENT_DESCRIPTIONS.SHARED} ` +
  `Within unit graph: ${RECORD_GROUP_EXTENT_DESCRIPTIONS.WITHIN_GRAPH} ` +
  `Within unit: ${RECORD_GROUP_EXTENT_DESCRIPTIONS.WITHIN_UNIT} ` +
  'A replicate measured again over time, such as a tagged branch, should be a child unit rather than a code.'

export const extentLabel = (extent) => RECORD_GROUP_EXTENT_LABELS[extent] ?? extent ?? ''

export const isWithinUnit = (extent) => extent === 'WITHIN_UNIT'
