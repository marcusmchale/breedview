import { useDatetimeUtils } from '@/composables/parsers/partialDatetime';

export function useValueParser() {
  const { validatePartialDatetime } = useDatetimeUtils();

  const parseDuration = (value) => {
    // Porting the backend logic: P(n)Y(n)M(n)DT(n)H(n)M(n)S
    const trimmed = value.replace(/\s+/g, '');
    if (trimmed.length < 2) throw new Error('ISO8601 durations must be at least 2 characters');
    if (!trimmed.startsWith('P')) throw new Error("ISO8601 durations must start with 'P'");

    const isoRegex = /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/;
    if (!isoRegex.test(trimmed)) {
      throw new Error('Invalid ISO8601 duration format (e.g., P1D, PT12H)');
    }
    return trimmed;
  };

  const parseNumeric = (value) => {
    const normalized = value.toString().replace(',', '.');
    if (isNaN(parseFloat(normalized)) || !isFinite(normalized)) {
      throw new Error('Value must be a valid number');
    }
    return normalized.trim();
  };

  const parseCategory = (value, categories) => {
    const valFold = value.toLowerCase().trim();
    // Match against names (case-insensitive)
    const matches = categories.filter(c => {
      const names = [c.name, ...(c.synonyms || []), c.id?.toString()].filter(Boolean);
      return names.some(n => n.toLowerCase() === valFold);
    });

    if (matches.length === 0) {
      throw new Error(`"${value}" does not match any valid category`);
    } else if (matches.length > 1) {
      throw new Error(`"${value}" is ambiguous (matches multiple categories)`);
    }
    return matches[0].name; // Return canonical name
  };

  const parseValue = (value, scale, categories = []) => {
    if (value === null || value === undefined || value === '') return '';

    const type = scale?.scaleType || 'TEXT';

    try {
      switch (type) {
        case 'DATE':
        case 'DATETIME':
          if (!validatePartialDatetime(value)) {
            throw new Error('Invalid datetime format');
          }
          return value.trim();

        case 'DURATION':
          return parseDuration(value);

        case 'NUMERICAL':
          return parseNumeric(value);

        case 'TEXT':
          if (!value.toString().trim()) throw new Error('Text values cannot be empty');
          return value.toString().trim();

        case 'NOMINAL':
        case 'ORDINAL':
          return parseCategory(value, categories);

        case 'COMPLEX':
          return value;

        default:
          return value;
      }
    } catch (e) {
      return { error: e.message };
    }
  };

  return {
    parseValue,
  };
}