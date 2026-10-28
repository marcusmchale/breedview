// Messages of an analysis pinned to the items of its form (anchorMessages and anchoredFormPath in
// src/composables/analysis/useAnalysisForm.js), so that the editor shows them on their items after others are removed
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  anchorMessages,
  anchoredFormPath,
  createEmptyExclusion,
  createEmptyForm,
  createTerm,
  removeTermReferences
} from '../../src/composables/analysis/useAnalysisForm.js'

const HEIGHT = { type: 'CONCEPT', conceptId: '43' }
const WIDTH = { type: 'CONCEPT', conceptId: '45' }
const LIGHT = { type: 'CONCEPT', conceptId: '53' }

const formOf = () => {
  const form = createEmptyForm()
  form.analysisType = 'ANOVA'
  form.datasetIds = ['4', '10', '5']
  form.terms = [createTerm(HEIGHT), createTerm(WIDTH), createTerm(LIGHT)]
  form.exclusions = [{ ...createEmptyExclusion(), unitIds: ['999'] }, { ...createEmptyExclusion(), unitIds: ['13'] }]
  form.grouping.time = { assignment: 'MIDPOINT', binning: { boundaries: ['2021-01-01'], labels: ['early', 'late'], boundary: 'LEFT' } }
  form.interactions = [{ terms: [{ ...WIDTH }, { ...LIGHT }] }, { terms: [{ ...HEIGHT }, { ...WIDTH }, { ...LIGHT }] }]
  return form
}

const message = (path) => ({ code: 'X', message: path.join('.'), path })
const paths = (messages, form) => messages.map((m) => anchoredFormPath(m, form))

test('messages stay where they are while nothing is removed', () => {
  const form = formOf()
  const messages = anchorMessages(
    [
      message(['anova', 'terms', '1', 'replicateAggregation']),
      message(['datasetIds', '2']),
      message(['exclusions', '1']),
      message(['anova', 'alpha']),
      message(['anova', 'grouping', 'time', 'binning', 'labels', '1'])
    ],
    form
  )
  assert.deepEqual(paths(messages, form), [
    'terms.1.replicateAggregation',
    'datasetIds.2',
    'exclusions.1',
    'options.alpha',
    'grouping.time.binning.labels.1'
  ])
})

test('a message follows its term, dataset or rule when one before it is removed, and goes with its own', () => {
  const form = formOf()
  const messages = anchorMessages(
    [
      message(['anova', 'terms', '0', 'aggregation']),
      message(['anova', 'terms', '1', 'replicateAggregation']),
      message(['datasetIds', '1']),
      message(['datasetIds', '2']),
      message(['exclusions', '0']),
      message(['exclusions', '1'])
    ],
    form
  )
  removeTermReferences(form, HEIGHT)
  form.datasetIds = form.datasetIds.filter((id) => id !== '4')
  form.exclusions.splice(0, 1)
  assert.deepEqual(paths(messages, form), [null, 'terms.0.replicateAggregation', 'datasetIds.0', 'datasetIds.1', null, 'exclusions.0'])
})

test('a dataset moved in the order takes its message along', () => {
  const form = formOf()
  const [m] = anchorMessages([message(['datasetIds', '0'])], form)
  form.datasetIds = ['10', '5', '4']
  assert.equal(anchoredFormPath(m, form), 'datasetIds.2')
})

test('interactions keep their messages when a term of another is removed', () => {
  const form = formOf()
  const messages = anchorMessages([message(['anova', 'interactions', '0']), message(['anova', 'interactions', '1', 'terms', '2'])], form)
  // the first interaction, of width and light, goes; the second keeps light, now its second term
  removeTermReferences(form, WIDTH)
  assert.deepEqual(form.interactions.map((i) => i.terms.map((t) => t.conceptId)), [['43', '53']])
  assert.deepEqual(paths(messages, form), [null, 'interactions.0.terms.1'])
})

test('a message about a section goes when the section is turned off', () => {
  const form = formOf()
  const messages = anchorMessages(
    [message(['anova', 'grouping', 'time', 'binning', 'boundaries', '0']), message(['anova', 'grouping', 'time'])],
    form
  )
  form.grouping.time = null
  assert.deepEqual(paths(messages, form), [null, null])
})

test('a message about an empty field stays when the field is set', () => {
  const form = formOf()
  const [m] = anchorMessages([message(['anova', 'response'])], form)
  form.response = { ...HEIGHT }
  assert.equal(anchoredFormPath(m, form), 'response')
})

test('a value listed twice keeps its message at its own index', () => {
  const form = formOf()
  form.grouping.time.binning.labels = ['', '']
  const [m] = anchorMessages([message(['anova', 'grouping', 'time', 'binning', 'labels', '1'])], form)
  assert.equal(anchoredFormPath(m, form), 'grouping.time.binning.labels.1')
})

test('messages without a path, or with one past the form, keep it', () => {
  const form = formOf()
  const messages = anchorMessages([{ code: 'X', message: '', path: null }, message(['anova', 'terms', '7', 'binning'])], form)
  assert.deepEqual(paths(messages, form), ['', 'terms.7.binning'])
})
