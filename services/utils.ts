export const stripHtml = (html: string | undefined): string => {
    if (!html) return "";
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || "";
    } catch (e) {
        // Fallback for invalid HTML or environments where DOMParser is not available.
        // A simple regex might not be perfect but is a decent fallback.
        return String(html).replace(/<[^>]+>/g, '');
    }
};
