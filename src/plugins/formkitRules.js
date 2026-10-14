// A year, month, day or minute: YYYY, YYYY-MM, YYYY-MM-DD or YYYY-MM-DDTHH:MM; empty passes
const partialDateTimeRegex = /^(\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2})?)?)?)?$/
export const isPartialDatetime = (value) => !value || partialDateTimeRegex.test(value)

export const createPartialDatetimeRule = () => ({
  name: 'partialDatetime',
  rule: ({ value }) => isPartialDatetime(value)
})
