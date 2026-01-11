
export function useDatetimeUtils() {
  // Regex for numpy datetime64 compatible partial datetime
  //const partialDateTimeRegex = /^(\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2})?)?)?)?)?$/;
  const partialDateTimeRegex = /^(\d{4}(-\d{2}(-\d{2}(T\d{2}(:\d{2}(:\d{2})?)?)?)?)?)?$/;

  /**
   * Validates a partial datetime string
   * @param {string} value - The datetime string to validate
   * @returns {boolean} - True if valid
   */
  const validatePartialDatetime = (value) => {
    if (!value) return true;
    return partialDateTimeRegex.test(value);
  };

  /**
   * Parse and normalize partial datetime string
   * @param {string} value - Input value
   * @returns {string|null} - Normalized partial datetime, empty string for empty input, or null if invalid
   */
  const normalizePartialDatetime = (value) => {
    // Return empty string for empty/null values
    if (!value || value.trim() === '') return '';

    const trimmed = value.trim();
    if (!validatePartialDatetime(trimmed)) {
      return null;
    }

    return trimmed;
  };

  /**
   * Gets a human-readable label for partial datetime granularity
   * @param {string} value - Partial datetime string
   * @returns {string} - Description of granularity
   */
  const getDatetimeGranularity = (value) => {
    if (!value) return 'Not set';

    if (/^\d{4}$/.test(value)) return 'Year';
    if (/^\d{4}-\d{2}$/.test(value)) return 'Month';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Day';
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'Minute';

    return 'Unknown';
  };

  return {
    validatePartialDatetime,
    normalizePartialDatetime,
    getDatetimeGranularity,
  };
}