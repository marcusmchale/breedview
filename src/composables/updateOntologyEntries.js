
import { useMutation } from '@vue/apollo-composable'

import UPDATE_TERM from '../graphql/ontology/updateTerm.graphql'
import UPDATE_SUBJECT from '../graphql/ontology/updateSubject.graphql'
import UPDATE_TRAIT from '../graphql/ontology/updateTrait.graphql'
import UPDATE_CONDITION from '../graphql/ontology/updateCondition.graphql'
import UPDATE_SCALE from '../graphql/ontology/updateScale.graphql'
import UPDATE_CATEGORY from '../graphql/ontology/updateCategory.graphql'
import UPDATE_OBSERVATION_METHOD from '../graphql/ontology/updateObservationMethod.graphql'
import UPDATE_VARIABLE from '../graphql/ontology/updateVariable.graphql'
import UPDATE_CONTROL_METHOD from '../graphql/ontology/updateControlMethod.graphql'
import UPDATE_FACTOR from '../graphql/ontology/updateFactor.graphql'
import UPDATE_EVENT from '../graphql/ontology/updateEvent.graphql'
import UPDATE_LOCATION_TYPE from '../graphql/ontology/updateLocationType.graphql'
import UPDATE_DESIGN from '../graphql/ontology/updateDesign.graphql'
import UPDATE_LAYOUT_TYPE from '../graphql/ontology/updateLayoutType.graphql'

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

// Export mutations
export function useOntologyUpdateMutations() {
  return {
    updateTermMutation: useMutation(UPDATE_TERM).mutate,
    updateSubjectMutation: useMutation(UPDATE_SUBJECT).mutate,
    updateTraitMutation: useMutation(UPDATE_TRAIT).mutate,
    updateConditionMutation: useMutation(UPDATE_CONDITION).mutate,
    updateScaleMutation: useMutation(UPDATE_SCALE).mutate,
    updateCategoryMutation: useMutation(UPDATE_CATEGORY).mutate,
    updateObservationMethodMutation: useMutation(UPDATE_OBSERVATION_METHOD).mutate,
    updateVariableMutation: useMutation(UPDATE_VARIABLE).mutate,
    updateControlMethodMutation: useMutation(UPDATE_CONTROL_METHOD).mutate,
    updateFactorMutation: useMutation(UPDATE_FACTOR).mutate,
    updateEventMutation: useMutation(UPDATE_EVENT).mutate,
    updateLocationTypeMutation: useMutation(UPDATE_LOCATION_TYPE).mutate,
    updateDesignMutation: useMutation(UPDATE_DESIGN).mutate,
    updateLayoutTypeMutation: useMutation(UPDATE_LAYOUT_TYPE).mutate
  }
}

const getCurrentValues = (entry) => {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description || '',
    parentIds: entry.parents ? entry.parents.map(p => p.id) : [],
    childIds: entry.children ? entry.children.map(c => c.id) : [],
    termIds: entry.terms ? entry.terms.map(t => t.id) : [],
    // For Term type - these come directly from the entry
    subjectIds: entry.subjects ? entry.subjects.map(s => s.id) : [],
    scaleIds: entry.scales ? entry.scales.map(s => s.id) : [],
    categoryIds: entry.categories ? entry.categories.map(c => c.id) : [],
    observationMethodIds: entry.observationMethods ? entry.observationMethods.map(o => o.id) : [],
    traitIds: entry.traits ? entry.traits.map(t => t.id) : [],
    variableIds: entry.variables ? entry.variables.map(v => v.id) : [],
    controlMethodIds: entry.controlMethods ? entry.controlMethods.map(c => c.id) : [],
    conditionIds: entry.conditions ? entry.conditions.map(c => c.id) : [],
    factorIds: entry.factors ? entry.factors.map(f => f.id) : [],
    eventIds: entry.events ? entry.events.map(e => e.id) : [],
    locationTypeIds: entry.locationTypes ? entry.locationTypes.map(l => l.id) : [],
    layoutTypeIds: entry.layoutTypes ? entry.layoutTypes.map(l => l.id) : [],
    designIds: entry.designs ? entry.designs.map(d => d.id) : [],
    roleIds: entry.roles ? entry.roles.map(r => r.id) : [],
    titleIds: entry.titles ? entry.titles.map(t => t.id) : [],
    // For Variable - single objects, not arrays
    traitId: entry.trait ? entry.trait.id : undefined,
    observationMethodId: entry.observationMethod ? entry.observationMethod.id : undefined,
    scaleId: entry.scale ? entry.scale.id : undefined,
    // For Factor - single objects, not arrays
    conditionId: entry.condition ? entry.condition.id : undefined,
    controlMethodId: entry.controlMethod ? entry.controlMethod.id : undefined,
    // scaleId is already defined above for Factor as well
    // For Scale
    scaleType: entry.scaleType
  }
}

const prepareSingleSelectOptions = (entries, currentValue) => {
  // Convert to number to ensure consistent comparison
  const currentValueId = currentValue ? Number(currentValue) : null

  // Process all entries
  const processedOptions = entries.map(entry => ({
    label: entry.name,
    value: entry.id
  }))

  // If current value exists, move it to the top of the list
  if (currentValueId) {
    const currentValueIndex = processedOptions.findIndex(option =>
      Number(option.value) === currentValueId
    )

    if (currentValueIndex !== -1) {
      const [currentOption] = processedOptions.splice(currentValueIndex, 1)
      processedOptions.unshift(currentOption)
    }
  }

  return processedOptions
}


export function prepareMultiselectOptions(
  fieldName,     // Name of the field (e.g., 'parentIds')
  allEntries,    // All available entries of the system
  currentRelatedEntryIds, // IDs of currently related entries
  currentEntryId, //ID of the entry being updated
  filterFn = null, // Optional custom filter function
  labelKey = 'name' // Optional custom label key
) {
  // Normalize currentRelatedEntryIds to an array of numbers
  const relatedIds = (currentRelatedEntryIds || [])
    .map(id => Number(id))
    .filter(id => !isNaN(id))

  // If no filter function provided, use a default that allows all entries
  const filterFunction = filterFn || (() => true)

  // Process all entries
  const processedOptions = allEntries
    .filter(entry => {
      // Apply custom filter if provided
      // Exclude the current entry if it's a parent/child selection
      return filterFunction(entry) &&
             (!entry.id || Number(entry.id) !== Number(currentEntryId))
    })
    .map(entry => ({
      label: entry[labelKey] || entry.name,
      value: entry.id,
      // Mark entries that are already related
      isPreExisting: relatedIds.includes(Number(entry.id))
    }))
    // Sort so pre-existing entries appear first
    .sort((a, b) => Number(b.isPreExisting) - Number(a.isPreExisting))
  console.log(processedOptions)
  return processedOptions
}


// Update handlers
export function updateTermHandler(context) {
  const { entry, ontologyEntries, updateTermMutation, openForm } = context

  const currentValues = getCurrentValues(entry, ontologyEntries)

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
    'Update Term',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter term name', value: currentValues.name },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)', value: currentValues.description },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Terms',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'parentIds',
          terms,
          currentValues.parentIds || [],
          entry.id
        ),
        placeholder: 'Select parent terms (optional)',
        value: currentValues.parentIds
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Terms',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'childIds',
          terms,
          currentValues.childIds || [],
          entry.id
        ),
        placeholder: 'Select child terms (optional)',
        value: currentValues.childIds
      },
      {
        name: 'subjectIds',
        type: 'select',
        label: 'Subjects',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'subjectIds',
          subjects,
          currentValues.subjectIds || [],
          entry.id
        ),
        placeholder: 'Select subjects (optional)',
        value: currentValues.subjectIds
      },
      {
        name: 'scaleIds',
        type: 'select',
        label: 'Scales',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'scaleIds',
          scales,
          currentValues.scaleIds || [],
          entry.id
        ),
        placeholder: 'Select scales (optional)',
        value: currentValues.scaleIds
      },
      {
        name: 'categoryIds',
        type: 'select',
        label: 'Categories',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'categoryIds',
          categories,
          currentValues.categoryIds || [],
          entry.id
        ),
        placeholder: 'Select categories (optional)',
        value: currentValues.categoryIds
      },
      {
        name: 'observationMethodIds',
        type: 'select',
        label: 'Observation Methods',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'observationMethodIds',
          observationMethods,
          currentValues.observationMethodIds || [],
          entry.id
        ),
        placeholder: 'Select observation methods (optional)',
        value: currentValues.observationMethodIds
      },
      {
        name: 'traitIds',
        type: 'select',
        label: 'Traits',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'traitIds',
          traits,
          currentValues.traitIds || [],
          entry.id
        ),
        placeholder: 'Select traits (optional)',
        value: currentValues.traitIds
      },
      {
        name: 'variableIds',
        type: 'select',
        label: 'Variables',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'variableIds',
          variables,
          currentValues.variableIds || [],
          entry.id
        ),
        placeholder: 'Select variables (optional)',
        value: currentValues.variableIds
      },
      {
        name: 'controlMethodIds',
        type: 'select',
        label: 'Control Methods',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'controlMethodIds',
          controlMethods,
          currentValues.controlMethodIds || [],
          entry.id
        ),
        placeholder: 'Select control methods (optional)',
        value: currentValues.controlMethodIds
      },
      {
        name: 'conditionIds',
        type: 'select',
        label: 'Conditions',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'conditionIds',
          conditions,
          currentValues.conditionIds || [],
          entry.id
        ),
        placeholder: 'Select conditions (optional)',
        value: currentValues.conditionIds
      },
      {
        name: 'factorIds',
        type: 'select',
        label: 'Factors',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'factorIds',
          factors,
          currentValues.factorIds || [],
          entry.id
        ),
        placeholder: 'Select factors (optional)',
        value: currentValues.factorIds
      },
      {
        name: 'eventIds',
        type: 'select',
        label: 'Events',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'eventIds',
          events,
          currentValues.eventIds || [],
          entry.id
        ),
        placeholder: 'Select events (optional)',
        value: currentValues.eventIds
      },
      {
        name: 'locationTypeIds',
        type: 'select',
        label: 'Location Types',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'locationTypeIds',
          locationTypes,
          currentValues.locationTypeIds || [],
          entry.id
        ),
        placeholder: 'Select location types (optional)',
        value: currentValues.locationTypeIds
      },
      {
        name: 'layoutTypeIDs',
        type: 'select',
        label: 'Layout Types',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'layoutTypeIDs',
          layoutTypes,
          currentValues.layoutTypeIDs || [],
          entry.id
        ),
        placeholder: 'Select layout types (optional)',
        value: currentValues.layoutTypeIDs
      },
      {
        name: 'designIds',
        type: 'select',
        label: 'Designs',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'designIds',
          designs,
          currentValues.designIds || [],
          entry.id
        ),
        placeholder: 'Select designs (optional)',
        value: currentValues.designIds
      },
      {
        name: 'roleIds',
        type: 'select',
        label: 'Roles',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'roleIds',
          roles,
          currentValues.roleIds || [],
          entry.id
        ),
        placeholder: 'Select roles (optional)',
        value: currentValues.roleIds
      },
      {
        name: 'titleIds',
        type: 'select',
        label: 'Titles',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'titleIds',
          titles,
          currentValues.titleIds || [],
          entry.id
        ),
        placeholder: 'Select titles (optional)',
        value: currentValues.titleIds
      }
    ],
    (formData) => {
      const processedData = {
        id: entry.id,
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

      return updateTermMutation({ term: processedData })
    }
  )
}

export function updateSubjectHandler(context) {
  const { entry, ontologyEntries, updateSubjectMutation, openForm } = context

  const currentValues = getCurrentValues(entry, ontologyEntries)
  const subjects = getEntriesByType(ontologyEntries, 'Subject')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm(
    'Update Subject',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter subject name', value: currentValues.name },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)', value: currentValues.description },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Subjects',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'parentIds',
          subjects,
          currentValues.parentIds || [],
          entry.id
        ),
        placeholder: 'Select parent subjects (optional)',
        value: currentValues.parentIds
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Subjects',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'childIds',
          subjects,
          currentValues.childIds || [],
          entry.id
        ),
        placeholder: 'Select child subjects (optional)',
        value: currentValues.childIds
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
          options: prepareMultiselectOptions(
          'termIds',
          terms,
          currentValues.termIds || [],
          entry.id
        ),
        placeholder: 'Select terms (optional)',
        value: currentValues.termIds
      }
    ],
    (formData) => {
      const processedData = {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return updateSubjectMutation({ subject: processedData })
    }
  )
}

export function updateTraitHandler(context) {
  const { entry, ontologyEntries, updateTraitMutation, openForm } = context

  const currentValues = getCurrentValues(entry, ontologyEntries)
  const traits = getEntriesByType(ontologyEntries, 'Trait')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const subjects = getEntriesByType(ontologyEntries, 'Subject')

  openForm(
    'Update Trait',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter trait name', value: currentValues.name },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)', value: currentValues.description },
      {
        name: 'subjectIds',
        type: 'select',
        label: 'Subjects',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'subjectIds',
          subjects,
          currentValues.subjectIds || [],
          entry.id
        ),
        placeholder: 'Select subjects (optional)',
        value: currentValues.subjectIds
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Traits',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'parentIds',
          traits,
          currentValues.parentIds || [],
          entry.id
        ),
        placeholder: 'Select parent traits (optional)',
        value: currentValues.parentIds
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Traits',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'childIds',
          traits,
          currentValues.childIds || [],
          entry.id
        ),
        placeholder: 'Select child traits (optional)',
        value: currentValues.childIds
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'termIds',
          terms,
          currentValues.termIds || [],
          entry.id
        ),
        placeholder: 'Select terms (optional)',
        value: currentValues.termIds
      }
    ],
    (formData) => {
      const processedData = {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        subjectIds: processIdArray(formData.subjectIds)
      }

      return updateTraitMutation({ trait: processedData })
    }
  )
}

export function updateConditionHandler(context) {
  const { entry, ontologyEntries, updateConditionMutation, openForm } = context

  const currentValues = getCurrentValues(entry, ontologyEntries)
  const conditions = getEntriesByType(ontologyEntries, 'Condition')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const subjects = getEntriesByType(ontologyEntries, 'Subject')

  openForm(
    'Update Condition',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter condition name', value: currentValues.name },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)', value: currentValues.description },
      {
        name: 'subjectIds',
        type: 'select',
        label: 'Subjects',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'subjectIds',
          subjects,
          currentValues.subjectIds || [],
          entry.id
        ),
        placeholder: 'Select subjects (optional)',
        value: currentValues.subjectIds
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Conditions',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'parentIds',
          conditions,
          currentValues.parentIds || [],
          entry.id
        ),
        placeholder: 'Select parent conditions (optional)',
        value: currentValues.parentIds
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Conditions',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'childIds',
          conditions,
          currentValues.childIds || [],
          entry.id
        ),
        placeholder: 'Select child conditions (optional)',
        value: currentValues.childIds
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'termIds',
          terms,
          currentValues.termIds || [],
          entry.id
        ),
        placeholder: 'Select terms (optional)',
        value: currentValues.termIds
      }
    ],
    (formData) => {
      const processedData = {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        subjectIds: processIdArray(formData.subjectIds),
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds)
      }

      return updateConditionMutation({ condition: processedData })
    }
  )
}


export function updateScaleHandler(context) {
  const { entry, ontologyEntries, updateScaleMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const scales = getEntriesByType(ontologyEntries, 'Scale')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const categories = getEntriesByType(ontologyEntries, 'Category')

  openForm(
    'Update Scale',
    [
      { name: 'name', type: 'text', label: 'Name', validation: 'required', placeholder: 'Enter scale name', value: currentValues.name },
      { name: 'description', type: 'textarea', label: 'Description', validation: '', placeholder: 'Enter description (optional)', value: currentValues.description },
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
          { label: 'Germplasm', value: 'GERMPLASM' }
        ],
        value: entry.scaleType
      },
      {
        name: 'parentIds',
        type: 'select',
        label: 'Parent Scales',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'parentIds',
          scales,
          currentValues.parentIds || [],
          entry.id
        ),
        placeholder: 'Select parent scales (optional)',
        value: currentValues.parentIds
      },
      {
        name: 'childIds',
        type: 'select',
        label: 'Child Scales',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'childIds',
          scales,
          currentValues.childIds || [],
          entry.id
        ),
        placeholder: 'Select child scales (optional)',
        value: currentValues.childIds
      },
      {
        name: 'termIds',
        type: 'select',
        label: 'Terms',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'termIds',
          terms,
          currentValues.termIds || [],
          entry.id
        ),
        placeholder: 'Select terms (optional)',
        value: currentValues.termIds
      },
      {
        name: 'categoryIds',
        type: 'select',
        label: 'Categories',
        validation: '',
        multiple: true,
        options: prepareMultiselectOptions(
          'categoryIds',
          categories,
          currentValues.categoryIds || [],
          entry.id
        ),
        placeholder: 'Select categories in rank order (optional)',
        value: currentValues.categoryIds
      }
    ],
    (formData) => {
      const processedData = {
        id: entry.id,
        name: formData.name,
        description: formData.description || undefined,
        scaleType: formData.scaleType,
        parentIds: processIdArray(formData.parentIds),
        childIds: processIdArray(formData.childIds),
        termIds: processIdArray(formData.termIds),
        categoryIds: processIdArray(formData.categoryIds)
      }

      return updateScaleMutation({ scale: processedData })
    }
  )
}

export function updateCategoryHandler(context) {
  const { entry, ontologyEntries, updateCategoryMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const categories = getEntriesByType(ontologyEntries, 'Category')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm('Update Category', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description }, 
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Categories',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        categories,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent categories (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Categories',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        categories,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child categories (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateCategoryMutation({ category: { id: entry.id, name: formData.name, description: formData.description || undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateObservationMethodHandler(context) {
  const { entry, ontologyEntries, updateObservationMethodMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const observationMethods = getEntriesByType(ontologyEntries, 'ObservationMethod')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm('Update Observation Method', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description }, 
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Observation Methods',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        observationMethods,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent observation methods (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Observation Methods',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        observationMethods,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child observation methods (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateObservationMethodMutation({ observationMethod: { id: entry.id, name: formData.name, description: formData.description || undefined, observationType: formData.observationType, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateVariableHandler(context) {
  const { entry, ontologyEntries, updateVariableMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const variables = getEntriesByType(ontologyEntries, 'Variable')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const traits = getEntriesByType(ontologyEntries, 'Trait')
  const observationMethods = getEntriesByType(ontologyEntries, 'ObservationMethod')
  const scales = getEntriesByType(ontologyEntries, 'Scale')

  const traitId = currentValues.traitId
  const observationMethodId = currentValues.observationMethodId
  const scaleId = currentValues.scaleId

  openForm('Update Variable', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    {
        name: 'traitId',
        type: 'select',
        label: 'Trait',
        validation: 'required',
        options: prepareSingleSelectOptions(traits, traitId),
        value: traitId
    },
    {
        name: 'observationMethodId',
        type: 'select',
        label: 'Observation Method',
        validation: 'required',
        options: prepareSingleSelectOptions(observationMethods, observationMethodId),
        value: observationMethodId
    },
    {
        name: 'scaleId',
        type: 'select',
        label: 'Scale',
        validation: 'required',
        options: prepareSingleSelectOptions(scales, scaleId),
        value: scaleId
    },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Variables',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        variables,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent variables (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child variables',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        variables,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child variables (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateVariableMutation({ variable: { id: entry.id, name: formData.name, description: formData.description || undefined, traitId: formData.traitId ? parseInt(formData.traitId) : undefined, observationMethodId: formData.observationMethodId ? parseInt(formData.observationMethodId) : undefined, scaleId: formData.scaleId ? parseInt(formData.scaleId) : undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateControlMethodHandler(context) {
  const { entry, ontologyEntries, updateControlMethodMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const controlMethods = getEntriesByType(ontologyEntries, 'ControlMethod')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm('Update Control Method', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    { name: 'controlType', type: 'select', label: 'Control Type', validation: 'required', options: [{ label: 'Environmental', value: 'ENVIRONMENTAL' }, { label: 'Nutritional', value: 'NUTRITIONAL' }, { label: 'Chemical', value: 'CHEMICAL' }, { label: 'Biological', value: 'BIOLOGICAL' }, { label: 'Genetic', value: 'GENETIC' }, { label: 'Management', value: 'MANAGEMENT' }], value: entry.controlType },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Control Methods',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        controlMethods,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent control methods (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Control Methods',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        controlMethods,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child control methods (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateControlMethodMutation({ controlMethod: { id: entry.id, name: formData.name, description: formData.description || undefined, controlType: formData.controlType, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateFactorHandler(context) {
  const { entry, ontologyEntries, updateFactorMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const factors = getEntriesByType(ontologyEntries, 'Factor')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const conditions = getEntriesByType(ontologyEntries, 'Condition')
  const controlMethods = getEntriesByType(ontologyEntries, 'ControlMethod')
  const scales = getEntriesByType(ontologyEntries, 'Scale')

  const conditionId = currentValues.conditionId
  const controlMethodId = currentValues.controlMethodId
  const scaleId = currentValues.scaleId

  openForm('Update Factor', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    {
        name: 'conditionId',
        type: 'select',
        label: 'Condition',
        validation: 'required',
        options: prepareSingleSelectOptions(conditions, conditionId),
        value: conditionId
    },
    {
        name: 'controlMethodId',
        type: 'select',
        label: 'Control Method',
        validation: 'required',
        options: prepareSingleSelectOptions(controlMethods, controlMethodId),
        value: controlMethodId
    },
    {
        name: 'scaleId',
        type: 'select',
        label: 'Scale',
        validation: 'required',
        options: prepareSingleSelectOptions(scales, scaleId),
        value: scaleId
    },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Factors',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        factors,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent factors (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Factors',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        factors,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child factors (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateFactorMutation({ factor: { id: entry.id, name: formData.name, description: formData.description || undefined, conditionId: formData.conditionId ? parseInt(formData.conditionId) : undefined, controlMethodId: formData.controlMethodId ? parseInt(formData.controlMethodId) : undefined, scaleId: formData.scaleId ? parseInt(formData.scaleId) : undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateEventHandler(context) {
  const { entry, ontologyEntries, updateEventMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const events = getEntriesByType(ontologyEntries, 'Event')
  const terms = getEntriesByType(ontologyEntries, 'Term')
  const variables = getEntriesByType(ontologyEntries, 'Variable')
  const factors = getEntriesByType(ontologyEntries, 'Factor')

  openForm('Update Event', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    {
      name: 'variableIds',
      type: 'select',
      label: 'Variables',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'variableIds',
        variables,
        currentValues.variableIds || [],
        entry.id
      ),
      placeholder: 'Select variables (optional)',
      value: currentValues.variableIds
    },
    {
      name: 'factorIds',
      type: 'select',
      label: 'Factors',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'factorIds',
        factors,
        currentValues.factorIds || [],
        entry.id
      ),
      placeholder: 'Select factors (optional)',
      value: currentValues.factorIds
    },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Events',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        events,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent events (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Events',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        events,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child events (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    }

  ], (formData) => updateEventMutation({ event: { id: entry.id, name: formData.name, description: formData.description || undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds), variableIds: processIdArray(formData.variableIds), factorIds: processIdArray(formData.factorIds) } }))
}

export function updateLocationTypeHandler(context) {
  const { entry, ontologyEntries, updateLocationTypeMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const locationTypes = getEntriesByType(ontologyEntries, 'LocationType')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm('Update Location Type', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Location Types',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        locationTypes,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent location types (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Location Types',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        locationTypes,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child location types (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateLocationTypeMutation({ locationType: { id: entry.id, name: formData.name, description: formData.description || undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateDesignHandler(context) {
  const { entry, ontologyEntries, updateDesignMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const designs = getEntriesByType(ontologyEntries, 'Design')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm('Update Design', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Designs',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        designs,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent designs (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Designs',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        designs,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child designs (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateDesignMutation({ design: { id: entry.id, name: formData.name, description: formData.description || undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

export function updateLayoutTypeHandler(context) {
  const { entry, ontologyEntries, updateLayoutTypeMutation, openForm } = context
  const currentValues = getCurrentValues(entry, ontologyEntries)
  const layoutTypes = getEntriesByType(ontologyEntries, 'LayoutType')
  const terms = getEntriesByType(ontologyEntries, 'Term')

  openForm('Update Layout Type', [
    { name: 'name', type: 'text', label: 'Name', validation: 'required', value: currentValues.name },
    { name: 'description', type: 'textarea', label: 'Description', value: currentValues.description },
    {
      name: 'parentIds',
      type: 'select',
      label: 'Parent Layout Types',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'parentIds',
        layoutTypes,
        currentValues.parentIds || [],
        entry.id
      ),
      placeholder: 'Select parent layout types (optional)',
      value: currentValues.parentIds
    },
    {
      name: 'childIds',
      type: 'select',
      label: 'Child Layout Types',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'childIds',
        layoutTypes,
        currentValues.childIds || [],
        entry.id
      ),
      placeholder: 'Select child layout types (optional)',
      value: currentValues.childIds
    },
    {
      name: 'termIds',
      type: 'select',
      label: 'Terms',
      validation: '',
      multiple: true,
      options: prepareMultiselectOptions(
        'termIds',
        terms,
        currentValues.termIds || [],
        entry.id
      ),
      placeholder: 'Select terms (optional)',
      value: currentValues.termIds
    },
  ], (formData) => updateLayoutTypeMutation({ layoutType: { id: entry.id, name: formData.name, description: formData.description || undefined, parentIds: processIdArray(formData.parentIds), childIds: processIdArray(formData.childIds), termIds: processIdArray(formData.termIds) } }))
}

// Export all handlers
export function useOntologyUpdateHandlers() {
  return {
    updateTerm: updateTermHandler,
    updateSubject: updateSubjectHandler,
    updateTrait: updateTraitHandler,
    updateCondition: updateConditionHandler,
    updateScale: updateScaleHandler,
    updateCategory: updateCategoryHandler,
    updateObservationMethod: updateObservationMethodHandler,
    updateVariable: updateVariableHandler,
    updateControlMethod: updateControlMethodHandler,
    updateFactor: updateFactorHandler,
    updateEvent: updateEventHandler,
    updateLocationType: updateLocationTypeHandler,
    updateDesign: updateDesignHandler,
    updateLayoutType: updateLayoutTypeHandler
  }
}