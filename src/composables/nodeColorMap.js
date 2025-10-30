
// Map from ontology enum labels (e.g., CONTROL_METHOD) to their display properties
export const ontologyLabelsMap = {
  CATEGORY: {
    text: 'Category',
    PascalCase: 'Category',
    code: 'Cat',
    color: '#E63946'  // Vivid red
  },
  CONDITION: {
    text: 'Condition',
    PascalCase: 'Condition',
    code: 'Cond',
    color: '#2A9D8F'  // Teal green
  },
  CONTROL_METHOD: {
    text: 'Control Method',
    PascalCase: 'ControlMethod',
    code: 'CM',
    color: '#F4A261'  // Sandy orange
  },
  DESIGN: {
    text: 'Design',
    PascalCase: 'Design',
    code: 'Des',
    color: '#7209B7'  // Deep purple
  },
  EVENT: {
    text: 'Event',
    PascalCase: 'Event',
    code: 'Evt',
    color: '#F77F00'  // Bright orange
  },
  FACTOR: {
    text: 'Factor',
    PascalCase: 'Factor',
    code: 'Fac',
    color: '#06FFA5'  // Bright mint
  },
  LAYOUT_TYPE: {
    text: 'Layout Type',
    PascalCase: 'LayoutType',
    code: 'LT',
    color: '#4361EE'  // Royal blue
  },
  LOCATION_TYPE: {
    text: 'Location Type',
    PascalCase: 'LocationType',
    code: 'Loc',
    color: '#90BE6D'  // Olive green
  },
  OBSERVATION_METHOD: {
    text: 'Observation Method',
    PascalCase: 'ObservationMethod',
    code: 'OM',
    color: '#FF006E'  // Hot magenta
  },
  SCALE: {
    text: 'Scale',
    PascalCase: 'Scale',
    code: 'Sc',
    color: '#8338EC'  // Violet purple
  },
  SUBJECT: {
    text: 'Subject',
    PascalCase: 'Subject',
    code: 'S',
    color: '#3A86FF'  // Bright blue
  },
  TERM: {
    text: 'Term',
    PascalCase: 'Term',
    code: 'T',
    color: '#FFBE0B'  // Golden yellow
  },
  TRAIT: {
    text: 'Trait',
    PascalCase: 'Trait',
    code: 'Tr',
    color: '#FB5607'  // Vivid coral
  },
  VARIABLE: {
    text: 'Variable',
    PascalCase: 'Variable',
    code: 'Var',
    color: '#06D6A0'  // Aqua green
  },
  ROLE: {
    text: 'Role',
    PascalCase: 'Role',
    code: 'Rol',
    color: '#000000'
  },
  TITLE: {
    text: 'Title',
    PascalCase: 'Title',
    code: 'Ti',
    color: '#999999'
  }
}
// Reverse lookup map: PascalCase -> enum label
const pascalCaseToEnumMap = Object.entries(ontologyLabelsMap).reduce((acc, [enumLabel, config]) => {
  acc[config.PascalCase] = enumLabel
  return acc
}, {})

// Helper to find label config by either enum label or PascalCase
function getLabelConfig(identifier) {
  // Try as enum label first
  if (ontologyLabelsMap[identifier]) {
    return ontologyLabelsMap[identifier]
  }
  // Try as PascalCase
  const enumLabel = pascalCaseToEnumMap[identifier]
  if (enumLabel) {
    return ontologyLabelsMap[enumLabel]
  }
  return null
}

// Get color by enum label (e.g., 'CONTROL_METHOD') or PascalCase type name (e.g., 'ControlMethod')
export function getNodeColor(identifier) {
  const config = getLabelConfig(identifier)
  return config?.color || '#666666'
}

// Get code by enum label or PascalCase type name
export function getNodeCode(identifier) {
  const config = getLabelConfig(identifier)
  return config?.code || ''
}

// Get display text by enum label or PascalCase
export function getNodeText(identifier) {
  const config = getLabelConfig(identifier)
  return config?.text || identifier
}

// Get PascalCase by enum label
export function getNodePascalCase(enumLabel) {
  return ontologyLabelsMap[enumLabel]?.PascalCase || enumLabel
}

// Get enum label from PascalCase
export function getEnumLabel(pascalCase) {
  return pascalCaseToEnumMap[pascalCase] || pascalCase
}

// Get all ontology labels as array
export function getOntologyLabels() {
  return Object.keys(ontologyLabelsMap)
}