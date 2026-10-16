// Record group type extent: whether a grouping's codes mean anything across units.

export const RECORD_GROUP_EXTENT_LABELS = {
  SHARED: 'Shared',
  WITHIN_UNIT: 'Within unit'
}

export const RECORD_GROUP_EXTENT_DESCRIPTIONS = {
  SHARED: 'A code names a group of many units, e.g. Block 2 or Batch 3. Records of different units with the same code belong together.',
  WITHIN_UNIT: 'A code only tells apart the readings of one unit at one time, e.g. replicate or subsample numbers. ' +
    'Replicate 1 of one tree has nothing to do with replicate 1 of another.'
}

export const RECORD_GROUP_EXTENT_HELP =
  `Shared: ${RECORD_GROUP_EXTENT_DESCRIPTIONS.SHARED} ` +
  `Within unit: ${RECORD_GROUP_EXTENT_DESCRIPTIONS.WITHIN_UNIT} ` +
  'A replicate measured again over time, such as a tagged branch, should be a child unit rather than a code.'

export const extentLabel = (extent) => RECORD_GROUP_EXTENT_LABELS[extent] ?? extent ?? ''

export const isWithinUnit = (extent) => extent === 'WITHIN_UNIT'
