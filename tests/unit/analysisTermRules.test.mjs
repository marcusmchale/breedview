// Hints of the analysis editor (src/composables/analysis/useTermRules.js)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createEmptyForm, createEstimatedMeans, createTerm } from '../../src/composables/analysis/useAnalysisForm.js'
import { analysisHints, blockingProblems } from '../../src/composables/analysis/useTermRules.js'

const HEIGHT = { type: 'CONCEPT', conceptId: '43' }
const LIGHT = { type: 'CONCEPT', conceptId: '53' }
const conceptsById = { 43: { scaleType: 'NUMERICAL' }, 53: { scaleType: 'NUMERICAL' } }
const HINT = 'Estimated means are of fixed categorical terms: remove the struck-out terms from them.'

const anova = () => {
  const form = createEmptyForm()
  form.analysisType = 'ANOVA'
  form.datasetIds = ['4', '10']
  form.terms = [createTerm(HEIGHT), { ...createTerm(LIGHT), representation: 'CATEGORICAL' }]
  form.response = { ...HEIGHT }
  form.estimatedMeans = [{ ...createEstimatedMeans(), terms: [{ ...LIGHT }] }]
  return form
}

test('estimated means of a term since made continuous, or random, are hinted at', () => {
  const form = anova()
  assert.ok(!analysisHints(form, conceptsById).includes(HINT), 'light, categorical, is fine')

  form.terms[1].representation = null
  assert.ok(analysisHints(form, conceptsById).includes(HINT), 'light, a number, is continuous')

  form.terms[1].representation = 'CATEGORICAL'
  form.terms[1].effect = 'RANDOM'
  assert.ok(analysisHints(form, conceptsById).includes(HINT), 'a random term')
})

test('estimated means conditioned on the response are hinted at', () => {
  const form = anova()
  form.estimatedMeans[0].by = [{ ...HEIGHT }]
  assert.ok(analysisHints(form, conceptsById).includes(HINT))
})

test('an observation unit by subject needs its subjects before the analysis is submitted', () => {
  const form = anova()
  const problem = "Choose the subjects of the observation unit, or observe each record's unit."
  assert.ok(!blockingProblems(form).includes(problem), "each record's unit by default")
  form.grouping.unit = { subjectIds: [] }
  assert.ok(blockingProblems(form).includes(problem))
  form.grouping.unit.subjectIds.push('31')
  assert.ok(!blockingProblems(form).includes(problem))
})
