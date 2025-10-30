import { useMutation } from '@vue/apollo-composable'

import CREATE_TERM from '../graphql/ontology/createTerm.graphql'
import CREATE_SUBJECT from '../graphql/ontology/createSubject.graphql'
import CREATE_TRAIT from '../graphql/ontology/createTrait.graphql'
import CREATE_CONDITION from '../graphql/ontology/createCondition.graphql'
import CREATE_SCALE from '../graphql/ontology/createScale.graphql'
import CREATE_CATEGORY from '../graphql/ontology/createCategory.graphql'
import CREATE_OBSERVATION_METHOD from '../graphql/ontology/createObservationMethod.graphql'
import CREATE_VARIABLE from '../graphql/ontology/createVariable.graphql'
import CREATE_CONTROL_METHOD from '../graphql/ontology/createControlMethod.graphql'
import CREATE_FACTOR from '../graphql/ontology/createFactor.graphql'
import CREATE_EVENT from '../graphql/ontology/createEvent.graphql'
import CREATE_LOCATION_TYPE from '../graphql/ontology/createLocationType.graphql'
import CREATE_DESIGN from '../graphql/ontology/createDesign.graphql'
import CREATE_LAYOUT_TYPE from '../graphql/ontology/createLayoutType.graphql'

// Helper functions
const processIdArray = (ids) => {
  if (ids && ids.length > 0) {
    return ids.map(id => parseInt(id))
  }
  return undefined
}

const getEntriesByType = (entries, typename) => {
  return entries.filter(entry => entry.__typename === typename)
}

const mapToSelectOptions = (entries) => {
  return entries.map(entry => ({ label: entry.name, value: entry.id }))
}

// Export mutations
export function useOntologyCreateMutations() {
  return {
    createTermMutation: useMutation(CREATE_TERM).mutate,
    createSubjectMutation: useMutation(CREATE_SUBJECT).mutate,
    createTraitMutation: useMutation(CREATE_TRAIT).mutate,
    createConditionMutation: useMutation(CREATE_CONDITION).mutate,
    createScaleMutation: useMutation(CREATE_SCALE).mutate,
    createCategoryMutation: useMutation(CREATE_CATEGORY).mutate,
    createObservationMethodMutation: useMutation(CREATE_OBSERVATION_METHOD).mutate,
    createVariableMutation: useMutation(CREATE_VARIABLE).mutate,
    createControlMethodMutation: useMutation(CREATE_CONTROL_METHOD).mutate,
    createFactorMutation: useMutation(CREATE_FACTOR).mutate,
    createEventMutation: useMutation(CREATE_EVENT).mutate,
    createLocationTypeMutation: useMutation(CREATE_LOCATION_TYPE).mutate,
    createDesignMutation: useMutation(CREATE_DESIGN).mutate,
    createLayoutTypeMutation: useMutation(CREATE_LAYOUT_TYPE).mutate
  }
}

// Creator handlers
export function createTermHandler(context) {
  const { ontologyEntries, createTermMutation, openForm } = context

  const terms = getEntriesByType(ontologyEntries, 'Term')
  const subjects = getEntriesByType(ontologyEntries, 'Subject')
  const scales = getEntriesByType(ontologyEntries, 'Scale')
  const categories = getEntriesByType(ontologyEntries, 'Category')
  const observationMethods = getEntriesByType(ontologyEntries, 'ObservationMethod')
  const traits = getEntriesByType(ontologyEntries, 'Trait')
  const variables = getEntriesByType(ontologyEntries, 'Variable')
  const controlMethods = getEntriesByType(ontologyEntries, 'ControlMethod')
  const conditions = getEntriesByType(ontologyEntries, 'Condition')
  const factors = getEntriesByType(ontologyEntries, 'Factor')
  const events = getEntriesByType(ontologyEntries, 'Event')
  const locationTypes = getEntriesByType(ontologyEntries, 'LocationType')
  const layoutTypes = getEntriesByType(ontologyEntries, 'LayoutType')
  const designs = getEntriesByType(ontologyEntries, 'Design')
  const roles = getEntriesByType(ontologyEntries, 'Role')
  const titles = getEntriesByType(ontologyEntries, 'Title')

  openForm(
    'Create Term',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter term name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select parent terms (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select child terms (optional)'
      },
      {
        name: 'subjectIds',
        type: 'select',
        label: 'Subjects',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(subjects),
        placeholder: 'Select subjects (optional)'
      },
      {
        name: 'scaleIds',
        type: 'select',
        label: 'Scales',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(scales),
        placeholder: 'Select scales (optional)'
      },
      {
        name: 'categoryIds',
        type: 'select',
        label: 'Categories',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(categories),
        placeholder: 'Select categories (optional)'
      },
      {
        name: 'observationMethodIds',
        type: 'select',
        label: 'Observation Methods',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(observationMethods),
        placeholder: 'Select observation methods (optional)'
      },
      {
        name: 'traitIds',
        type: 'select',
        label: 'Traits',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(traits),
        placeholder: 'Select traits (optional)'
      },
      {
        name: 'variableIds',
        type: 'select',
        label: 'Variables',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(variables),
        placeholder: 'Select variables (optional)'
      },
      {
        name: 'controlMethodIds',
        type: 'select',
        label: 'Control Methods',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(controlMethods),
        placeholder: 'Select control methods (optional)'
      },
      {
        name: 'conditionIds',
        type: 'select',
        label: 'Conditions',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(conditions),
        placeholder: 'Select conditions (optional)'
      },
      {
        name: 'factorIds',
        type: 'select',
        label: 'Factors',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(factors),
        placeholder: 'Select factors (optional)'
      },
      {
        name: 'eventIds',
        type: 'select',
        label: 'Events',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(events),
        placeholder: 'Select events (optional)'
      },
      {
        name: 'locationTypeIds',
        type: 'select',
        label: 'Location Types',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(locationTypes),
        placeholder: 'Select location types (optional)'
      },
      {
        name: 'layoutTypeIDs',
        type: 'select',
        label: 'Layout Types',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(layoutTypes),
        placeholder: 'Select layout types (optional)'
      },
      {
        name: 'designIds',
        type: 'select',
        label: 'Designs',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(designs),
        placeholder: 'Select designs (optional)'
      },
      {
        name: 'roleIds',
        type: 'select',
        label: 'Roles',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(roles),
        placeholder: 'Select roles (optional)'
      },
      {
        name: 'titleIds',
        type: 'select',
        label: 'Titles',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(titles),
        placeholder: 'Select titles (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
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
        layoutTypeIDs: processIdArray(formData.layoutTypeIDs),
        designIds: processIdArray(formData.designIds),
        roleIds: processIdArray(formData.roleIds),
        titleIds: processIdArray(formData.titleIds)
      }

      return createTermMutation({ term: processedData })
    }
  )
}

export function createSubjectHandler(context) {
  const { ontologyEntries, createSubjectMutation, openForm } = context

  const subjects = getEntriesByType(ontologyEntries, 'Subject')
  const traits = getEntriesByType(ontologyEntries, 'Trait')
  const conditions = getEntriesByType(ontologyEntries, 'Conditions')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Subject',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter subject name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Subjects',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(subjects),
        placeholder: 'Select parent subjects (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Subjects',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(subjects),
        placeholder: 'Select child subjects (optional)'
      },
      {
        name: 'traitIds',
        type: 'select',
        label: 'Traits',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(traits),
        placeholder: 'Select traits (optional)'
      },
      {
        name: 'conditionIds',
        type: 'select',
        label: 'Conditions',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(conditions),
        placeholder: 'Select conditions (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createSubjectMutation({ subject: processedData })
    }
  )
}

export function createTraitHandler(context) {
  const { ontologyEntries, createTraitMutation, openForm } = context

  const traits = getEntriesByType(ontologyEntries, 'Trait')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const subjects = getEntriesByType(ontologyEntries, 'Subject')

  openForm(
    'Create Trait',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter trait name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'subjectIds',
        type: 'select',
        label: 'Subjects',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(subjects),
        placeholder: 'Select subjects (optional)'
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Traits',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(traits),
        placeholder: 'Select parent traits (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Traits',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(traits),
        placeholder: 'Select child traits (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        subjectIds: processIdArray(formData.subjectIds)
      }

      return createTraitMutation({ trait: processedData })
    }
  )
}

export function createConditionHandler(context) {
  const { ontologyEntries, createConditionMutation, openForm } = context

  const conditions = getEntriesByType(ontologyEntries, 'Condition')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const subjects = getEntriesByType(ontologyEntries, 'Subject')

  openForm(
    'Create Condition',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter condition name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'subjectIds',
        type: 'select',
        label: 'Subjects',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(subjects),
        placeholder: 'Select subjects (optional)'
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Conditions',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(conditions),
        placeholder: 'Select parent conditions (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Conditions',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(conditions),
        placeholder: 'Select child conditions (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createConditionMutation({ condition: processedData })
    }
  )
}

export function createScaleHandler(context) {
  const { ontologyEntries, createScaleMutation, openForm } = context

  const scales = getEntriesByType(ontologyEntries, 'Scale')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const categories = getEntriesByType(ontologyEntries, 'Category')

  openForm(
    'Create Scale',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter scale name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'scaleType',
        type: 'select',
        label: 'Scale Type',
        validation: 'required',
        options: [
          { label: 'Date', value: 'DATE' },
          { label: 'Duration', value: 'DURATION' },
          { label: 'Numerical', value: 'NUMERICAL' },
          { label: 'Nominal', value: 'NOMINAL' },
          { label: 'Ordinal', value: 'ORDINAL' },
          { label: 'Text', value: 'TEXT' },
          { label: 'Germplasm', value: 'GERMPLASM' },
          { label: 'Complex', value: 'COMPLEX' }
        ]
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Scales',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(scales),
        placeholder: 'Select parent scales (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Scales',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(scales),
        placeholder: 'Select child scales (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      },
      {
        name: 'categoryIds',
        type: 'select',
        label: 'Categories',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(categories),
        placeholder: 'Select categories in rank order (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        scaleType: formData.scaleType,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        categoryIds: processIdArray(formData.categoryIds)
      }

      return createScaleMutation({ scale: processedData })
    }
  )
}

export function createCategoryHandler(context) {
  const { ontologyEntries, createCategoryMutation, openForm } = context

  const categories = getEntriesByType(ontologyEntries, 'Category')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Category',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter category name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Categories',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(categories),
        placeholder: 'Select parent categories (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Categories',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(categories),
        placeholder: 'Select child categories (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createCategoryMutation({ category: processedData })
    }
  )
}

export function createObservationMethodHandler(context) {
  const { ontologyEntries, createObservationMethodMutation, openForm } = context

  const observationMethods = getEntriesByType(ontologyEntries, 'ObservationMethod')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Observation Method',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter observation method name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'observationType',
        type: 'select',
        label: 'Observation Type',
        validation: 'required',
        options: [
          { label: 'Measurement', value: 'MEASUREMENT' },
          { label: 'Counting', value: 'COUNTING' },
          { label: 'Estimation', value: 'ESTIMATION' },
          { label: 'Computation', value: 'COMPUTATION' },
          { label: 'Prediction', value: 'PREDICTION' },
          { label: 'Description', value: 'DESCRIPTION' },
          { label: 'Classification', value: 'CLASSIFICATION' }
        ]
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Observation Methods',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(observationMethods),
        placeholder: 'Select parent observation methods (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Observation Methods',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(observationMethods),
        placeholder: 'Select child observation methods (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        observationType: formData.observationType,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createObservationMethodMutation({ observationMethod: processedData })
    }
  )
}

export function createVariableHandler(context) {
  const { ontologyEntries, createVariableMutation, openForm } = context

  const variables = getEntriesByType(ontologyEntries, 'Variable')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const traits = getEntriesByType(ontologyEntries, 'Trait')
  const observationMethods = getEntriesByType(ontologyEntries, 'ObservationMethod')
  const scales = getEntriesByType(ontologyEntries, 'Scale')

  openForm(
    'Create Variable',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter variable name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'traitId',
        type: 'select',
        label: 'Trait',
        validation: 'required',
        options: mapToSelectOptions(traits)
      },
      {
        name: 'observationMethodId',
        type: 'select',
        label: 'Observation Method',
        validation: 'required',
        options: mapToSelectOptions(observationMethods)
      },
      {
        name: 'scaleId',
        type: 'select',
        label: 'Scale',
        validation: 'required',
        options: mapToSelectOptions(scales)
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Variables',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(variables),
        placeholder: 'Select parent variables (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Variables',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(variables),
        placeholder: 'Select child variables (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        traitId: parseInt(formData.traitId),
        observationMethodId: parseInt(formData.observationMethodId),
        scaleId: parseInt(formData.scaleId),
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createVariableMutation({ variable: processedData })
    }
  )
}

export function createControlMethodHandler(context) {
  const { ontologyEntries, createControlMethodMutation, openForm } = context

  const controlMethods = getEntriesByType(ontologyEntries, 'ControlMethod')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Control Method',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter control method name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'controlType',
        type: 'select',
        label: 'Control Type',
        validation: 'required',
        options: [
          { label: 'Environmental', value: 'ENVIRONMENTAL' },
          { label: 'Nutritional', value: 'NUTRITIONAL' },
          { label: 'Chemical', value: 'CHEMICAL' },
          { label: 'Biological', value: 'BIOLOGICAL' },
          { label: 'Genetic', value: 'GENETIC' },
          { label: 'Management', value: 'MANAGEMENT' }
        ]
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Control Methods',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(controlMethods),
        placeholder: 'Select parent control methods (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Control Methods',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(controlMethods),
        placeholder: 'Select child control methods (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        controlType: formData.controlType,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createControlMethodMutation({ controlMethod: processedData })
    }
  )
}

export function createFactorHandler(context) {
  const { ontologyEntries, createFactorMutation, openForm } = context

  const factors = getEntriesByType(ontologyEntries, 'Factor')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const conditions = getEntriesByType(ontologyEntries, 'Condition')
  const controlMethods = getEntriesByType(ontologyEntries, 'ControlMethod')
  const scales = getEntriesByType(ontologyEntries, 'Scale')

  openForm(
    'Create Factor',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter factor name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'conditionId',
        type: 'select',
        label: 'Condition',
        validation: 'required',
        options: mapToSelectOptions(conditions)
      },
      {
        name: 'controlMethodId',
        type: 'select',
        label: 'Control Method',
        validation: 'required',
        options: mapToSelectOptions(controlMethods)
      },
      {
        name: 'scaleId',
        type: 'select',
        label: 'Scale',
        validation: 'required',
        options: mapToSelectOptions(scales)
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Factors',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(factors),
        placeholder: 'Select parent factors (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Factors',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(factors),
        placeholder: 'Select child factors (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        conditionId: parseInt(formData.conditionId),
        controlMethodId: parseInt(formData.controlMethodId),
        scaleId: parseInt(formData.scaleId),
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createFactorMutation({ factor: processedData })
    }
  )
}

export function createEventHandler(context) {
  const { ontologyEntries, createEventMutation, openForm } = context

  const events = getEntriesByType(ontologyEntries, 'Event')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const variables = getEntriesByType(ontologyEntries, 'Variable')
  const factors = getEntriesByType(ontologyEntries, 'Factor')

  openForm(
    'Create Event',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter event name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Events',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(events),
        placeholder: 'Select parent events (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Events',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(events),
        placeholder: 'Select child events (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      },
      {
        name: 'variableIds',
        type: 'select',
        label: 'Variables',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(variables),
        placeholder: 'Select variables (optional)'
      },
      {
        name: 'factorIds',
        type: 'select',
        label: 'Factors',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(factors),
        placeholder: 'Select factors (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        variableIds: processIdArray(formData.variableIds),
        factorIds: processIdArray(formData.factorIds)
      }

      return createEventMutation({ event: processedData })
    }
  )
}

export function createLocationTypeHandler(context) {
  const { ontologyEntries, createLocationTypeMutation, openForm } = context

  const locationTypes = getEntriesByType(ontologyEntries, 'LocationType')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Location Type',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter location type name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Location Types',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(locationTypes),
        placeholder: 'Select parent location types (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Location Types',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(locationTypes),
        placeholder: 'Select child location types (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createLocationTypeMutation({ locationType: processedData })
    }
  )
}

export function createDesignHandler(context) {
  const { ontologyEntries, createDesignMutation, openForm } = context

  const designs = getEntriesByType(ontologyEntries, 'Design')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Design',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter design name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Designs',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(designs),
        placeholder: 'Select parent designs (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Designs',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(designs),
        placeholder: 'Select child designs (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createDesignMutation({ design: processedData })
    }
  )
}

export function createLayoutTypeHandler(context) {
  const { ontologyEntries, createLayoutTypeMutation, openForm } = context

  const layoutTypes = getEntriesByType(ontologyEntries, 'LayoutType')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Create Layout Type',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter layout type name' },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)' },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Layout Types',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(layoutTypes),
        placeholder: 'Select parent layout types (optional)'
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Layout Types',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(layoutTypes),
        placeholder: 'Select child layout types (optional)'
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: mapToSelectOptions(terms),
        placeholder: 'Select terms (optional)'
      }
    ],
    (formData) => {
      const processedData = {
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return createLayoutTypeMutation({ layoutType: processedData })
    }
  )
}

// Export all handlers
export function useOntologyCreatorHandlers() {
  return {
    createTerm: createTermHandler,
    createSubject: createSubjectHandler,
    createTrait: createTraitHandler,
    createCondition: createConditionHandler,
    createScale: createScaleHandler,
    createCategory: createCategoryHandler,
    createObservationMethod: createObservationMethodHandler,
    createVariable: createVariableHandler,
    createControlMethod: createControlMethodHandler,
    createFactor: createFactorHandler,
    createEvent: createEventHandler,
    createLocationType: createLocationTypeHandler,
    createDesign: createDesignHandler,
    createLayoutType: createLayoutTypeHandler
  }
}