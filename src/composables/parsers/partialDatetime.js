
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


  // ============================================
  // Timepoint Grouping Utilities (for Analysis)
  // ============================================

  /**
   * Convert a partial datetime string to a comparable UTC timestamp (milliseconds).
   * Partial datetimes are expanded to their earliest possible moment.
   * @param {string} partialDatetime - Partial datetime string (e.g., "2010", "2010-06", "2010-06-15")
   * @returns {number|null} - UTC timestamp in milliseconds, or null if invalid
   */
  const toComparableTimestamp = (partialDatetime) => {
    if (!partialDatetime || !validatePartialDatetime(partialDatetime)) {
      return null;
    }

    const trimmed = partialDatetime.trim();

    // Expand partial datetime to full ISO string (earliest moment)
    let expanded = trimmed;
    if (/^\d{4}$/.test(trimmed)) {
      // Year only: YYYY -> YYYY-01-01T00:00:00
      expanded = `${trimmed}-01-01T00:00:00`;
    } else if (/^\d{4}-\d{2}$/.test(trimmed)) {
      // Year-month: YYYY-MM -> YYYY-MM-01T00:00:00
      expanded = `${trimmed}-01T00:00:00`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      // Full date: YYYY-MM-DD -> YYYY-MM-DDT00:00:00
      expanded = `${trimmed}T00:00:00`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}$/.test(trimmed)) {
      // Hour precision: YYYY-MM-DDTHH -> YYYY-MM-DDTHH:00:00
      expanded = `${trimmed}:00:00`;
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      // Minute precision: YYYY-MM-DDTHH:MM -> YYYY-MM-DDTHH:MM:00
      expanded = `${trimmed}:00`;
    }

    const date = new Date(expanded + 'Z'); // Parse as UTC
    return isNaN(date.getTime()) ? null : date.getTime();
  };

  /**
   * Calculate the midpoint timestamp between two partial datetimes.
   * @param {string} start - Start partial datetime
   * @param {string} end - End partial datetime
   * @returns {number|null} - Midpoint UTC timestamp in milliseconds, or null if either is invalid
   */
  const getMidpoint = (start, end) => {
    const startTs = toComparableTimestamp(start);
    const endTs = toComparableTimestamp(end);

    if (startTs === null || endTs === null) {
      return null;
    }

    return Math.floor((startTs + endTs) / 2);
  };

  /**
   * Assign a record to a timepoint bin based on boundaries.
   * Boundaries create bins: < boundary[0], [boundary[0], boundary[1]), ..., >= boundary[n-1]
   *
   * @param {Object} record - Record with start and end properties
   * @param {string[]} boundaries - Array of partial datetime boundary strings (sorted ascending)
   * @returns {Object} - { binIndex: number, binLabel: string, warnings: string[] }
   */
  const assignToTimepoint = (record, boundaries) => {
    const warnings = [];
    const result = { binIndex: -1, binLabel: null, warnings };

    if (!boundaries || boundaries.length === 0) {
      result.binLabel = 'All Data';
      result.binIndex = 0;
      return result;
    }

    const recordStart = record.start;
    const recordEnd = record.end;

    // Check for missing time data
    if (!recordStart && !recordEnd) {
      warnings.push('Record has no time data - excluded from timepoint analysis');
      return result;
    }

    const startTs = toComparableTimestamp(recordStart);
    const endTs = toComparableTimestamp(recordEnd);

    // Use available timestamp(s)
    let effectiveTs;
    if (startTs !== null && endTs !== null) {
      // Check if record spans a boundary
      const boundaryTimestamps = boundaries.map(b => toComparableTimestamp(b));

      for (let i = 0; i < boundaryTimestamps.length; i++) {
        const boundaryTs = boundaryTimestamps[i];
        if (boundaryTs !== null && startTs < boundaryTs && endTs > boundaryTs) {
          warnings.push(
            `Record spans boundary ${boundaries[i]} (start: ${recordStart}, end: ${recordEnd}). Using midpoint for assignment.`
          );
          break;
        }
      }

      effectiveTs = getMidpoint(recordStart, recordEnd);
    } else if (startTs !== null) {
      effectiveTs = startTs;
    } else if (endTs !== null) {
      effectiveTs = endTs;
    } else {
      warnings.push('Record has invalid time data - excluded from timepoint analysis');
      return result;
    }

    // Convert boundaries to timestamps
    const boundaryTimestamps = boundaries.map(b => toComparableTimestamp(b));

    // Find the bin
    let binIndex = 0;
    for (let i = 0; i < boundaryTimestamps.length; i++) {
      if (boundaryTimestamps[i] !== null && effectiveTs >= boundaryTimestamps[i]) {
        binIndex = i + 1;
      }
    }

    // Generate bin label
    result.binIndex = binIndex;
    result.binLabel = generateBinLabel(binIndex, boundaries);

    return result;
  };

  /**
   * Generate a human-readable label for a timepoint bin.
   * @param {number} binIndex - The bin index
   * @param {string[]} boundaries - Array of boundary strings
   * @returns {string} - Bin label
   */
  const generateBinLabel = (binIndex, boundaries) => {
    if (!boundaries || boundaries.length === 0) {
      return 'All Data';
    }

    if (binIndex === 0) {
      return `< ${boundaries[0]}`;
    } else if (binIndex >= boundaries.length) {
      return `≥ ${boundaries[boundaries.length - 1]}`;
    } else {
      return `${boundaries[binIndex - 1]} to ${boundaries[binIndex]}`;
    }
  };

  /**
   * Suggest timepoint boundaries based on data distribution.
   * @param {Object[]} records - Array of records with start/end properties
   * @param {string} strategy - Binning strategy: 'year', 'month', 'quartile', 'custom'
   * @param {number} numBins - Number of bins (for quartile strategy)
   * @returns {string[]} - Array of suggested boundary strings
   */
  const suggestBoundaries = (records, strategy = 'year', numBins = 4) => {
    // Extract all valid timestamps
    const timestamps = [];
    records.forEach(record => {
      const startTs = toComparableTimestamp(record.start);
      const endTs = toComparableTimestamp(record.end);

      if (startTs !== null) timestamps.push(startTs);
      if (endTs !== null) timestamps.push(endTs);
    });

    if (timestamps.length === 0) {
      return [];
    }

    timestamps.sort((a, b) => a - b);
    const minTs = timestamps[0];
    const maxTs = timestamps[timestamps.length - 1];

    const minDate = new Date(minTs);
    const maxDate = new Date(maxTs);

    const boundaries = [];

    switch (strategy) {
      case 'year': {
        const startYear = minDate.getUTCFullYear();
        const endYear = maxDate.getUTCFullYear();
        for (let year = startYear + 1; year <= endYear; year++) {
          boundaries.push(String(year));
        }
        break;
      }

      case 'month': {
        let current = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth() + 1, 1));
        while (current.getTime() <= maxTs) {
          const year = current.getUTCFullYear();
          const month = String(current.getUTCMonth() + 1).padStart(2, '0');
          boundaries.push(`${year}-${month}`);
          current.setUTCMonth(current.getUTCMonth() + 1);
        }
        break;
      }

      case 'quartile': {
        for (let i = 1; i < numBins; i++) {
          const idx = Math.floor((i / numBins) * timestamps.length);
          const ts = timestamps[Math.min(idx, timestamps.length - 1)];
          const date = new Date(ts);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, '0');
          const day = String(date.getUTCDate()).padStart(2, '0');
          boundaries.push(`${year}-${month}-${day}`);
        }
        break;
      }

      default:
        break;
    }

    // Remove duplicates and sort
    return [...new Set(boundaries)].sort();
  };


  return {
    validatePartialDatetime,
    normalizePartialDatetime,
    getDatetimeGranularity,
    // New timepoint utilities
    toComparableTimestamp,
    getMidpoint,
    assignToTimepoint,
    generateBinLabel,
    suggestBoundaries,
  };
}