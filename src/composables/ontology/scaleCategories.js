// A nominal or ordinal scale's categories are part of the scale, in order: records hold a category's name, and its
// description says what the name means on the scale.

// A category as offered where values are entered, e.g. "1 – No symptoms"
export const categoryLabel = (category) =>
  category.description ? `${category.name} – ${category.description}` : category.name
