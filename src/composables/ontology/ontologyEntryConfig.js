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

// Shared base fields present on every type
const nameField = { type: 'text', name: 'name', label: 'Name', validation: 'required', placeholder: 'Enter name' }
const descriptionField = { type: 'textarea', name: 'description', label: 'Description', placeholder: 'Enter description (optional)' }

// Multiselect field helpers
const multi = (name, label, sourceType, excludeSelf = true) => ({
  type: 'multiselect', name, label, sourceType, excludeSelf
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
      multi('childIds', 'Child Terms', 'Term'),
      multi('subjectIds', 'Subjects', 'Subject'),
      multi('scaleIds', 'Scales', 'Scale', false),
      multi('categoryIds', 'Categories', 'Category', false),
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
        categoryIds: processIdArray(formData.categoryIds),
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
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      term: {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        subjectIds: formData.subjectIds ?? [],
        scaleIds: formData.scaleIds ?? [],
        categoryIds: formData.categoryIds ?? [],
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
      multi('childIds', 'Child Subjects', 'Subject'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Traits', 'Trait'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Conditions', 'Condition'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Scales', 'Scale'),
      multi('termIds', 'Terms', 'Term', false),
      multi('categoryIds', 'Categories (rank order)', 'Category', false),
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
        categoryIds: processIdArray(formData.categoryIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      scale: {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        scaleType: formData.scaleType,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
        categoryIds: formData.categoryIds ?? [],
      }
    }),
  },

  Category: {
    typename: 'Category',
    createTitle: 'Create Category',
    updateTitle: 'Update Category',
    fields: [
      nameField,
      descriptionField,
      multi('parentIds', 'Parent Categories', 'Category'),
      multi('childIds', 'Child Categories', 'Category'),
      multi('termIds', 'Terms', 'Term', false),
    ],
    processCreate: (formData, referenceIds) => ({
      category: {
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
      }
    }),
    processUpdate: (entry, formData, referenceIds) => ({
      category: {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
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
      multi('childIds', 'Child Observation Methods', 'ObservationMethod'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Variables', 'Variable'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Control Methods', 'ControlMethod'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Factors', 'Factor'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Events', 'Event'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Location Types', 'LocationType'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Designs', 'Design'),
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
        description: formData.description || undefined,
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
      multi('childIds', 'Child Layout Types', 'LayoutType'),
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
        description: formData.description || undefined,
        axes: formData.axes?.length ? formData.axes : undefined,
        referenceIds: referenceIds?.length ? referenceIds : [],
        parentIds: formData.parentIds ?? [],
        childIds: formData.childIds ?? [],
        termIds: formData.termIds ?? [],
      }
    }),
  },
}