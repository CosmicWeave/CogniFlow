const STOCKHOLM_TIMEZONE = 'Europe/Stockholm';

/**
 * Gets the current date formatted as a string in the Stockholm timezone.
 * @returns {string} The formatted date string, e.g., "2024-05-20"
 */
export const getStockholmDateString = (): string => {
    return new Date().toLocaleDateString('sv-SE', {
        timeZone: STOCKHOLM_TIMEZONE,
    });
};

/**
 * Formats a Date object or UTC string into a filename-safe timestamp for Stockholm.
 * e.g., "2024-05-20_13-08-45"
 * @returns {string} The formatted timestamp.
 */
export const getStockholmFilenameTimestamp = (): string => {
    const now = new Date();
    // 'sv-SE' locale is close to ISO format (YYYY-MM-DD HH:mm:ss)
    return now.toLocaleString('sv-SE', {
        timeZone: STOCKHOLM_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).replace(/ /g, '_').replace(/:/g, '-');
};

/**
 * Formats a UTC ISO date string into a readable local date and time string for the Stockholm timezone.
 * @param dateString The UTC date string to format (e.g., from Google Drive `modifiedTime`).
 * @returns {string} A formatted string like "20 oktober 2023 12:34".
 */
export const formatUTCToStockholmString = (dateString: string): string => {
    if (!dateString) return 'N/A';
    try {
        return new Date(dateString).toLocaleString('sv-SE', {
            timeZone: STOCKHOLM_TIMEZONE,
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (e) {
        console.error("Failed to format date string:", dateString, e);
        return 'Invalid Date';
    }
};

/**
 * Helper to safely parse server date strings which might be timestamps or formatted strings.
 * @param dateValue The date value from the server (string, number, null, or undefined).
 * @returns {Date} A valid Date object or an invalid Date object if parsing fails.
 */
export const parseServerDate = (dateValue?: string | number | null): Date => {
    // Return an invalid date if the input is null, undefined, or an empty string
    if (!dateValue) {
      return new Date(NaN);
    }
    // Handle numeric timestamps (assuming seconds, convert to milliseconds)
    if (typeof dateValue === 'number') {
        return new Date(dateValue * 1000);
    }
    // Check if it's a numeric string (unix timestamp in seconds)
    if (/^\d+(\.\d+)?$/.test(dateValue)) {
      return new Date(parseFloat(dateValue) * 1000);
    }
    // Otherwise, try to parse it as a date string, making it more compatible.
    // Handles ISO 8601 format like "2025-08-31T06:43:54Z" correctly.
    return new Date(String(dateValue).replace(' ', 'T'));
};
