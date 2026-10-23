import { RECORD_GROUP_EXTENT_HELP, RECORD_GROUP_EXTENT_LABELS } from './recordGroupExtent'
import { clearable } from '@/composables/system/clearable'

const processIdArray = (ids) => {
  if (!ids || ids.length === 0) return undefined
  return ids
}

const SCALE_TYPE_OPTIONS = [
  { label: '', value: null },
  { label: 'Date', value: 'DATE' },
  { label: 'Duration', value: 'DURATION' },
  { label: 'Numerical', value: 'NUMERICAL' },
  { label: 'Nominal', value: 'NOMINAL' },
  { label: 'Ordinal', value: 'ORDINAL' },
  { label: 'Text', value: 'TEXT' },
  { label: 'Complex', value: 'COMPLEX' }
]

const OBSERVATION_TYPE_OPTIONS = [
  { label: '', value: null },
  { label: 'Measurement', value: 'MEASUREMENT' },
  { label: 'Counting', value: 'COUNTING' },
  { label: 'Estimation', value: 'ESTIMATION' },
  { label: 'Computation', value: 'COMPUTATION' },
  { label: 'Prediction', value: 'PREDICTION' },
  { label: 'Description', value: 'DESCRIPTION' },
  { label: 'Classification', value: 'CLASSIFICATION' }
]

const CONTROL_TYPE_OPTIONS = [
  { label: '', value: null },
  { label: 'Environmental', value: 'ENVIRONMENTAL' },
  { label: 'Nutritional', value: 'NUTRITIONAL' },
  { label: 'Chemical', value: 'CHEMICAL' },
  { label: 'Biological', value: 'BIOLOGICAL' },
  { label: 'Genetic', value: 'GENETIC' },
  { label: 'Management', value: 'MANAGEMENT' }
]

const AXES_OPTIONS = [
  { label: 'Nominal', value: 'NOMINAL' },
  { label: 'Ordinal', value: 'ORDINAL' },
  { label: 'Coordinate', value: 'COORDINATE' },
  { label: 'Cartesian', value: 'CARTESIAN' }
]

// The scale types that have categories
const CATEGORICAL_SCALE_TYPES = new Set(['NOMINAL', 'ORDINAL'])

// A scale's categories as the API takes them, in order; rows left without a name are dropped
const scaleCategories = (rows) => (rows ?? [])
  .map(row => ({ name: (row.name ?? '').trim(), description: (row.description ?? '').trim() || null }))
  .filter(row => row.name)

const RECORD_GROUP_EXTENT_OPTIONS = [
  { label: '', value: null },
  ...Object.entries(RECORD_GROUP_EXTENT_LABELS).map(([value, label]) => ({ label, value }))
]

// Shared base fields present on every type
const nameField = { type: 'text', name: 'name', label: 'Name', validation: 'required', placeholder: 'Enter name' }
const descriptionField = { type: 'textarea', name: 'description', label: 'Description', placeholder: 'Enter description (optional)' }

// Multiselect field helpers
const multi = (name, label, sourceType, excludeSelf = true, entryKey = null) => ({
  type: 'multiselect', name, label, sourceType, excludeSelf,
  entryKey: entryKey ?? name.replace(/Ids$/, 's')
})

// Singleselect field helpers
const single = (name, label, sourceType, validation = 'required') => ({
  type: 'singleselect', name, label, sourceType, validation
})

export const ONTOLOGY_ENTRY_CONFIGS = {
  Term: {
    typename: 'Term',
    createTitle: 'Create Term',
    updateTitle: 'Update Term',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Terms', 'Term'),
      multi('childIds', 'Child Terms', 'Term', true, 'children'),
      multi('subjectIds', 'Subjects', 'Subject'),
      multi('scaleIds', 'Scales', 'Scale', false),
      multi('observationMethodIds', 'Observation Methods', 'ObservationMethod', false),
      multi('traitIds', 'Traits', 'Trait', false),
      multi('variableIds', 'Variables', 'Variable', false),
      multi('controlMethodIds', 'Control Methods', 'ControlMethod', false),
      multi('conditionIds', 'Conditions', 'Condition', false),
      multi('factorIds', 'Factors', 'Factor', false),
      multi('eventIds', 'Events', 'Event', false),
      multi('locationTypeIds', 'Location Types', 'LocationType', false),
      multi('layoutTypeIds', 'Layout Types', 'LayoutType', false),
      multi('designIds', 'Designs', 'Design', false),
      multi('roleIds', 'Roles', 'Role', false),
      multi('recordGroupTypeIds', 'Record Group Types', 'RecordGroupType', false)
    ],
    processCreate: (formData, referenceIds) => ({
      term: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        subjectIds: processIdArray(formData.subjectIds),
        scaleIds: processIdArray(formData.scaleIds),
        observationMethodIds: processIdArray(formData.observationMethodIds),
        traitIds: processIdArray(formData.traitIds),
        variableIds: processIdArray(formData.variableIds),
        controlMethodIds: processIdArray(formData.controlMethodIds),
        conditionIds: processIdArray(formData.conditionIds),
        factorIds: processIdArray(formData.factorIds),
        eventIds: processIdArray(formData.eventIds),
        locationTypeIds: processIdArray(formData.locationTypeIds),
        layoutTypeIds: processIdArray(formData.layoutTypeIds),
        designIds: processIdArray(formData.designIds),
        roleIds: processIdArray(formData.roleIds),
        recordGroupTypeIds: processIdArray(formData.recordGroupTypeIds)
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      term: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        subjectIds: formData.subjectIds ?? [],
        scaleIds: formData.scaleIds ?? [],
        observationMethodIds: formData.observationMethodIds ?? [],
        traitIds: formData.traitIds ?? [],
        variableIds: formData.variableIds ?? [],
        controlMethodIds: formData.controlMethodIds ?? [],
        conditionIds: formData.conditionIds ?? [],
        factorIds: formData.factorIds ?? [],
        eventIds: formData.eventIds ?? [],
        locationTypeIds: formData.locationTypeIds ?? [],
        layoutTypeIds: formData.layoutTypeIds ?? [],
        designIds: formData.designIds ?? [],
        roleIds: formData.roleIds ?? [],
        recordGroupTypeIds: formData.recordGroupTypeIds ?? []
      }
    }),
  },

  Subject: {
    typename: 'Subject',
    createTitle: 'Create Subject',
    updateTitle: 'Update Subject',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Subjects', 'Subject'),
      multi('childIds', 'Child Subjects', 'Subject', true, 'children'),
      multi('traitIds', 'Traits', 'Trait', false),
      multi('conditionIds', 'Conditions', 'Condition', false),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      subject: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      subject: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  Trait: {
    typename: 'Trait',
    createTitle: 'Create Trait',
    updateTitle: 'Update Trait',
    fields: [
      nameField,
      descriptionField,
      multi('subjectIds', 'Subjects', 'Subject', false),
      multi('parentIds', 'Parent Traits', 'Trait'),
      multi('childIds', 'Child Traits', 'Trait', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      trait: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        subjectIds: processIdArray(formData.subjectIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      trait: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
        subjectIds: formData.subjectIds ?? [],
      }
    }),
  },

  Condition: {
    typename: 'Condition',
    createTitle: 'Create Condition',
    updateTitle: 'Update Condition',
    fields: [
      nameField,
      descriptionField,
      multi('subjectIds', 'Subjects', 'Subject', false),
      multi('parentIds', 'Parent Conditions', 'Condition'),
      multi('childIds', 'Child Conditions', 'Condition', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      condition: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      condition: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        subjectIds: formData.subjectIds ?? [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  Scale: {
    typename: 'Scale',
    createTitle: 'Create Scale',
    updateTitle: 'Update Scale',
    fields: [
      nameField,
      descriptionField,
      { type: 'enumselect', name: 'scaleType', label: 'Scale Type', validation: 'required', options: SCALE_TYPE_OPTIONS },
      multi('parentIds', 'Parent Scales', 'Scale'),
      multi('childIds', 'Child Scales', 'Scale', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
      {
        type: 'categoriesBuilder', name: 'categories', locks: true,
        labelFn: (formData) => formData.scaleType === 'ORDINAL' ? 'Categories (in rank order)' : 'Categories',
        showFn: (formData) => CATEGORICAL_SCALE_TYPES.has(formData.scaleType),
        help: "Records hold a category's name, so names must differ, and a name records hold can't be removed or renamed."
      },
    ],
    processCreate: (formData, referenceIds) => ({
      scale: {
        name: formData.name,
        description: formData.description || undefined,
        scaleType: formData.scaleType,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        categories: CATEGORICAL_SCALE_TYPES.has(formData.scaleType) ? scaleCategories(formData.categories) : undefined,
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      scale: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        scaleType: formData.scaleType,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
        // given, they replace the scale's: none for a scale type without categories
        categories: CATEGORICAL_SCALE_TYPES.has(formData.scaleType) ? scaleCategories(formData.categories) : [],
      }
    }),
  },

  ObservationMethod: {
    typename: 'ObservationMethod',
    createTitle: 'Create Observation Method',
    updateTitle: 'Update Observation Method',
    fields: [
      nameField,
      descriptionField,
      { type: 'enumselect', name: 'observationType', label: 'Observation Type', validation: 'required', options: OBSERVATION_TYPE_OPTIONS },
      multi('parentIds', 'Parent Observation Methods', 'ObservationMethod'),
      multi('childIds', 'Child Observation Methods', 'ObservationMethod', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      observationMethod: {
        name: formData.name,
        description: formData.description || undefined,
        observationType: formData.observationType,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      observationMethod: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        observationType: formData.observationType,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  Variable: {
    typename: 'Variable',
    createTitle: 'Create Variable',
    updateTitle: 'Update Variable',
    fields: [
      nameField,
      descriptionField,
      single('traitId', 'Trait', 'Trait'),
      single('observationMethodId', 'Observation Method', 'ObservationMethod'),
      single('scaleId', 'Scale', 'Scale'),
      multi('parentIds', 'Parent Variables', 'Variable'),
      multi('childIds', 'Child Variables', 'Variable', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      variable: {
        name: formData.name,
        description: formData.description || undefined,
        traitId: formData.traitId,
        observationMethodId: formData.observationMethodId,
        scaleId: formData.scaleId,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      variable: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        traitId: formData.traitId || undefined,
        observationMethodId: formData.observationMethodId || undefined,
        scaleId: formData.scaleId || undefined,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  ControlMethod: {
    typename: 'ControlMethod',
    createTitle: 'Create Control Method',
    updateTitle: 'Update Control Method',
    fields: [
      nameField,
      descriptionField,
      { type: 'enumselect', name: 'controlType', label: 'Control Type', validation: 'required', options: CONTROL_TYPE_OPTIONS },
      multi('parentIds', 'Parent Control Methods', 'ControlMethod'),
      multi('childIds', 'Child Control Methods', 'ControlMethod', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      controlMethod: {
        name: formData.name,
        description: formData.description || undefined,
        controlType: formData.controlType,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      controlMethod: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        controlType: formData.controlType,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  Factor: {
    typename: 'Factor',
    createTitle: 'Create Factor',
    updateTitle: 'Update Factor',
    fields: [
      nameField,
      descriptionField,
      single('conditionId', 'Condition', 'Condition'),
      single('controlMethodId', 'Control Method', 'ControlMethod'),
      single('scaleId', 'Scale', 'Scale'),
      multi('parentIds', 'Parent Factors', 'Factor'),
      multi('childIds', 'Child Factors', 'Factor', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      factor: {
        name: formData.name,
        description: formData.description || undefined,
        conditionId: formData.conditionId,
        controlMethodId: formData.controlMethodId,
        scaleId: formData.scaleId,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      factor: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        conditionId: formData.conditionId || undefined,
        controlMethodId: formData.controlMethodId || undefined,
        scaleId: formData.scaleId || undefined,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  Event: {
    typename: 'Event',
    createTitle: 'Create Event',
    updateTitle: 'Update Event',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Events', 'Event'),
      multi('childIds', 'Child Events', 'Event', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
      multi('variableIds', 'Variables', 'Variable', false),
      multi('factorIds', 'Factors', 'Factor', false),
    ],
    processCreate: (formData, referenceIds) => ({
      event: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        variableIds: processIdArray(formData.variableIds),
        factorIds: processIdArray(formData.factorIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      event: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
        variableIds: formData.variableIds ?? [],
        factorIds: formData.factorIds ?? [],
      }
    }),
  },

  LocationType: {
    typename: 'LocationType',
    createTitle: 'Create Location Type',
    updateTitle: 'Update Location Type',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Location Types', 'LocationType'),
      multi('childIds', 'Child Location Types', 'LocationType', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      locationType: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      locationType: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },

  Design: {
    typename: 'Design',
    createTitle: 'Create Design',
    updateTitle: 'Update Design',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Designs', 'Design'),
      multi('childIds', 'Child Designs', 'Design', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      design: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      design: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },


  RecordGroupType: {
    typename: 'RecordGroupType',
    createTitle: 'Create Record Group Type',
    updateTitle: 'Update Record Group Type',
    fields: [
      nameField,
      descriptionField,
      {
        type: 'enumselect', name: 'defaultExtent', label: 'Default extent', options: RECORD_GROUP_EXTENT_OPTIONS,
        help: `Prefills the extent of a new grouping of this type; each grouping sets its own. ${RECORD_GROUP_EXTENT_HELP}`
      },
      multi('parentIds', 'Parent Record Group Types', 'RecordGroupType'),
      multi('childIds', 'Child Record Group Types', 'RecordGroupType', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      recordGroupType: {
        name: formData.name,
        description: formData.description || undefined,
        defaultExtent: formData.defaultExtent || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      recordGroupType: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        defaultExtent: clearable(formData.defaultExtent, entry.defaultExtent),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },



  Role: {
    typename: 'Role',
    createTitle: 'Create Role',
    updateTitle: 'Update Role',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Roles', 'Role'),
      multi('childIds', 'Child Roles', 'Role', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      role: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      role: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },
  LayoutType: {
    typename: 'LayoutType',
    createTitle: 'Create Layout Type',
    updateTitle: 'Update Layout Type',
    fields: [
      nameField,
      descriptionField,
      { type: 'axesBuilder', name: 'axes', label: 'Axes (order matters)', options: AXES_OPTIONS },
      multi('parentIds', 'Parent Layout Types', 'LayoutType'),
      multi('childIds', 'Child Layout Types', 'LayoutType', true, 'children'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      layoutType: {
        name: formData.name,
        description: formData.description || undefined,
        axes: formData.axes?.length ? formData.axes : undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      layoutType: {
        id: entry.id,
        name: formData.name,
        description: clearable(formData.description, entry.description),
        axes: formData.axes?.length ? formData.axes : undefined,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },
}

/*
 * Every entry may be taken from an external standard or ontology: its source URL and how to attribute it (the CRediT
 * roles' licence requires the attribution). Added to each type's form after the description, and sent with its input;
 * on update, emptying one clears it.
 */
const sourceFields = [
  { type: 'text', name: 'sourceUrl', label: 'Source URL', placeholder: 'https://… (for an entry from an external standard)', locks: true },
  { type: 'text', name: 'sourceAttribution', label: 'Source attribution', placeholder: 'How to credit the source, e.g. its licence', locks: true }
]
for (const config of Object.values(ONTOLOGY_ENTRY_CONFIGS)) {
  const at = config.fields.indexOf(descriptionField) + 1
  config.fields.splice(at, 0, ...sourceFields)
  const { processCreate, processUpdate } = config
  const withSource = (variables, formData, entry) => {
    const input = Object.values(variables)[0]
    input.sourceUrl = clearable(formData.sourceUrl, entry?.sourceUrl)
    input.sourceAttribution = clearable(formData.sourceAttribution, entry?.sourceAttribution)
    return variables
  }
  config.processCreate = (formData, ...rest) => withSource(processCreate(formData, ...rest), formData, null)
  config.processUpdate = (entry, formData, ...rest) => withSource(processUpdate(entry, formData, ...rest), formData, entry)
}

/*
 * A locked entry keeps its name, abbreviation, description and source, a scale its categories, and the relationships
 * that define it; its synonyms, references, parents, children and terms stay editable (a Term's relationships all point
 * to it, so stay too)
 */
const OPEN_WHEN_LOCKED = new Set(['parentIds', 'childIds', 'termIds'])
export const isLockedField = (config, field) => {
  if (field.name === 'name' || field.name === 'description' || field.locks) return true
  if (config.typename === 'Term') return false
  return (field.type === 'multiselect' || field.type === 'singleselect') && !OPEN_WHEN_LOCKED.has(field.name)
}
