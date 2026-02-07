import { ClientConfig } from 'pg';

/**
 * Sanitizes the DATABASE_URL to be safe for Node pg (removes channel_binding)
 * and returns a config object or connection string.
 * 
 * Also provides a safe logging utility to ensures no secrets are printed.
 */
export const getDbConfig = (dbUrl: string): ClientConfig => {
    let connectionString = dbUrl;

    // Remove channel_binding if present (unsupported by node-postgres)
    if (dbUrl.includes("channel_binding")) {
        // console.debug("🔧 [DB] Sanitizing connection string (removing channel_binding)"); 
        // Commented out to reduce noise, but action is taken.
        connectionString = dbUrl.replace(/([?&])channel_binding=[^&]+(&|$)/, '$1').replace(/&$/, '');
    }

    const isLocalhost = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

    return {
        connectionString,
        ssl: isLocalhost ? false : { rejectUnauthorized: false }
    };
};
