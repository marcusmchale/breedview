/** A count and its word, singular for one: "1 record", "97 records", and "— units" for a count not known */
export const plural = (count, word) => `${count ?? '—'} ${word}${count === 1 ? '' : 's'}`
