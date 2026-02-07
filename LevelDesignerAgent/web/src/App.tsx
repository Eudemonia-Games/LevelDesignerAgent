import { useState, useEffect } from 'react';
import * as Shared from '@lda/shared';
import { Login } from './Login';
import { SecretsAdmin } from './SecretsAdmin';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;



function LogoutButton({ onLogout }: { onLogout: () => void }) {
    const handleLogout = async () => {
        if (!API_BASE_URL) return;
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            onLogout();
        } catch (err) {
            console.error("Logout failed", err);
            // Force logout client-side anyway
            onLogout();
        }
    };

    return (
        <button
            onClick={handleLogout}
            style={{
                padding: '5px 10px', fontSize: '0.8rem', cursor: 'pointer',
                background: '#ff4444', color: 'white', border: 'none', borderRadius: '4px'
            }}
        >
            Logout
        </button>
    );
}

function SystemStatus({ onLogout }: { onLogout: () => void }) {
    const [health, setHealth] = useState<{ status: string; version?: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!API_BASE_URL) {
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                setHealth(data);
                setError(null);
            })
            .catch(err => {
                setError(err.message === 'AbortError' ? 'Timeout' : err.message);
            })
            .finally(() => {
                clearTimeout(timeoutId);
                setLoading(false);
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, []);

    const statusColor = error ? 'red' : health?.status === 'ok' ? 'green' : 'gray';

    return (
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f9f9f9', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexGrow: 1 }}>
                <strong>LDA.Web:</strong> {Shared.APP_VERSION}
                <span>|</span>
                <strong>API:</strong> {API_BASE_URL || <span style={{ color: 'red' }}>Not Configured</span>}
                <span>|</span>
                <strong>Health:</strong> {' '}
                {loading ? (
                    <span>Checking...</span>
                ) : (
                    <span style={{ color: statusColor, fontWeight: 'bold' }}>
                        {error ? `Error: ${error}` : `OK (${health?.version || 'Unknown'})`}
                    </span>
                )}
            </div>
            <LogoutButton onLogout={onLogout} />
            {!API_BASE_URL && (
                <div style={{ color: 'red', marginTop: '5px', fontSize: '0.8rem' }}>
                    VITE_API_BASE_URL is not set. Configure it in Render for lda-web.
                </div>
            )}
        </div>
    );
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    const checkAuth = () => {
        if (!API_BASE_URL) {
            setIsAuthenticated(false);
            return;
        }

        fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
            .then(res => {
                if (res.ok) setIsAuthenticated(true);
                else setIsAuthenticated(false);
            })
            .catch(() => setIsAuthenticated(false));
    };

    useEffect(() => {
        checkAuth();
    }, []);

    if (isAuthenticated === null) {
        return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Loading...</div>;
    }

    if (!isAuthenticated) {
        return <Login onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    return (
        <div>
            <SystemStatus onLogout={() => setIsAuthenticated(false)} />
            <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
                <h1>LDA</h1>
                <p>Monorepo Agent System</p>
                <div style={{ marginTop: '20px', padding: '10px', border: '1px dashed #ccc' }}>
                    Core functionality coming in LDA.0.4.0
                </div>
                <SecretsAdmin onSessionExpired={() => setIsAuthenticated(false)} />
            </div>
        </div>
    );
}

export default App;
