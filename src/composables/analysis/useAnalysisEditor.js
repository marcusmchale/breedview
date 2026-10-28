import { inject, provide, toRaw } from 'vue'

const EDITOR_KEY = Symbol('analysisEditor')

/**
 * Shared state of the analysis editor, provided by AnalysisConfigEditor to its sections:
 * { form, data, messagesAt, exclusionFeedback }
 */
export const provideAnalysisEditor = (editor) => provide(EDITOR_KEY, editor)

export function useAnalysisEditor() {
  const editor = inject(EDITOR_KEY, null)
  if (!editor) throw new Error('useAnalysisEditor must be used inside AnalysisConfigEditor')
  return editor
}

const itemKeys = new WeakMap()
let nextItemKey = 0

/** A v-for key for an item of a form list (e.g. an exclusion rule) that stays with it when items before it are removed. */
export function itemKey(item) {
  const raw = toRaw(item)
  if (!itemKeys.has(raw)) itemKeys.set(raw, nextItemKey++)
  return itemKeys.get(raw)
}
