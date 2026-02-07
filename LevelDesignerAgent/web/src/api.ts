export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function fetchApi(path: string, options: RequestInit = {}) {
    if (!API_BASE_URL) throw new Error("API_BASE_URL not set");

    const url = `${API_BASE_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    const res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include' // Important for auth cookies
    });

    if (!res.ok) {
        let errorMessage = `HTTP ${res.status}`;
        try {
            const errData = await res.json();
            if (errData.error) errorMessage = errData.error;
        } catch { } // Ignore json parse error
        throw new Error(errorMessage);
    }

    // Return json if content-type says so, else text or void
    // Return json if content-type says so, else text or void
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        const text = await res.text();
        try {
            return text ? JSON.parse(text) : {};
        } catch (e) {
            throw new Error(`API returned invalid JSON (${res.status}): ${text.slice(0, 100)}...`);
        }
    }

    // If not JSON but status is OK, return text
    return res.text();
}
