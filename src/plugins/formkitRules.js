// A partial time as the API takes it, to a year, month, day, hour, minute or second: 2021, 2021-05, 2021-05-03,
// 2021-05-03T10, 2021-05-03T10:30 or 2021-05-03T10:30:15; empty passes
const partialDateTimeRegex = /^\d{4}(-\d{2}(-\d{2}(T\d{2}(:\d{2}(:\d{2})?)?)?)?)?$/
export const isPartialDatetime = (value) => !value || partialDateTimeRegex.test(String(value).trim())

// The partialDateTime validation rule and its message, for FormKit's defaultConfig: rules are a map of name to rule
export const partialDateTimeRule = (node) => isPartialDatetime(node.value)
export const partialDateTimeMessage = ({ name }) =>
  `${name} must be a time such as 2021, 2021-05, 2021-05-03 or 2021-05-03T10:30`
