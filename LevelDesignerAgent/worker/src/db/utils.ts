import { ClientConfig } from 'pg';

/**
 * Sanitizes the DATABASE_URL to be safe for node-postgres.
 * - removes channel_binding
 * - removes sslmode (we configure TLS via pg.ssl)
 */
export const getDbConfig = (dbUrl: string): ClientConfig => {
    let connectionString = dbUrl;

    // Remove channel_binding if present (unsupported by node-postgres)
    if (connectionString.includes('channel_binding')) {
        connectionString = connectionString.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    // Remove sslmode if present (pg-connection-string warns + semantics may change)
    if (connectionString.includes('sslmode')) {
        connectionString = connectionString.replace(/([?&])sslmode=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    return {
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false }
    };
};
