import { ClientConfig } from 'pg';

/**
 * Sanitizes the DATABASE_URL to be safe for Node pg (removes channel_binding)
 * and returns a config object.
 */
export const getDbConfig = (dbUrl: string): ClientConfig => {
    let connectionString = dbUrl;

    // Remove channel_binding if present (unsupported by node-postgres)
    if (dbUrl.includes("channel_binding")) {
        connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    // Also strip sslmode=... to avoid "parameter absent" warnings when we manually set ssl config below
    if (connectionString.includes("sslmode")) {
        connectionString = connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

    return {
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false }
    };
};
