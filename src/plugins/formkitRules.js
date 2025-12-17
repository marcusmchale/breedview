export const createPartialDatetimeRule = () => ({
  name: 'partialDatetime',
  rule: ({ value }) => {
    if (!value) return true
    const partialDateTimeRegex = /^(\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2})?)?)?)?$/
    return partialDateTimeRegex.test(value)
  }
})
