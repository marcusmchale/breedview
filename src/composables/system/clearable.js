// An update leaves a field it is not given unchanged, and clears an optional field given as null (breedgraph README,
// Updates). For an optional field of an update form: its value, trimmed if text; null once emptied of a value it had;
// or undefined, to leave it out, while it stays empty.
export const clearable = (value, previous) => {
  const given = typeof value === 'string' ? value.trim() : value
  if (given !== undefined && given !== null && given !== '') return given
  return previous !== undefined && previous !== null && previous !== '' ? null : undefined
}
