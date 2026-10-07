import { inject, provide } from 'vue'

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
