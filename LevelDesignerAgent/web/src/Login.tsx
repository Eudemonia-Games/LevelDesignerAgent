
import { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface LoginProps {
    onLoginSuccess: () => void;
}

export function Login({ onLoginSuccess }: LoginProps) {
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!API_BASE_URL) {
            setError("API URL not configured.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
                credentials: 'include' // Important for cookies
            });

            if (res.ok) {
                onLoginSuccess();
            } else {
                const data = await res.json();
                setError(data.error || 'Login failed');
            }
        } catch (err: any) {
            setError(err.message || 'Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh',
            fontFamily: 'sans-serif', backgroundColor: '#f0f2f5'
        }}>
            <form onSubmit={handleSubmit} style={{
                background: 'white', padding: '30px', borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)', width: '300px'
            }}>
                <h2 style={{ marginTop: 0, textAlign: 'center', color: '#333' }}>LDA Login</h2>

                {error && (
                    <div style={{
                        background: '#ffebee', color: '#c62828', padding: '10px',
                        borderRadius: '4px', marginBottom: '15px', fontSize: '0.9rem'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#555' }}>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', color: '#555' }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%', padding: '10px', background: '#007bff', color: 'white',
                        border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '1rem', fontWeight: 600
                    }}
                >
                    {loading ? 'Logging in...' : 'Login'}
                </button>
            </form>
        </div>
    );
}
