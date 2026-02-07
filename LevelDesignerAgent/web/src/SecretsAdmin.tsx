import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface SecretItem {
    key: string;
    isSet: boolean;
    masked: string | null;
    updatedAt: string | null;
}

interface SecretsAdminProps {
    onSessionExpired?: () => void;
}

export function SecretsAdmin({ onSessionExpired }: SecretsAdminProps) {
    const [secrets, setSecrets] = useState<SecretItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newValue, setNewValue] = useState("");
    const [saveStatus, setSaveStatus] = useState<{ key: string, msg: string, type: 'success' | 'error' } | null>(null);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const fetchSecrets = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/admin/secrets`, { credentials: 'include' })
            .then(res => {
                if (res.status === 401) {
                    onSessionExpired?.();
                    throw new Error("Session expired");
                }
                if (!res.ok) throw new Error("Failed to fetch secrets");
                return res.json();
            })
            .then(data => {
                setSecrets(data.secrets);
                setError(null);
            })
            .catch(err => {
                if (err.message !== "Session expired") {
                    setError(err.message);
                }
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (API_BASE_URL) fetchSecrets();
    }, []);

    const handleSave = async (key: string) => {
        setSaveStatus({ key, msg: "Saving...", type: 'success' });
        try {
            const res = await fetch(`${API_BASE_URL}/admin/secrets/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ value: newValue })
            });

            if (res.status === 401) {
                onSessionExpired?.();
                return;
            }

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save");
            }

            // Success
            setSaveStatus({ key, msg: "Saved ✓", type: 'success' });
            setNewValue("");
            setEditingKey(null);

            // Optimistic update or refresh
            fetchSecrets();

            setTimeout(() => setSaveStatus(null), 3000);
        } catch (err: any) {
            setSaveStatus({ key, msg: `Error: ${err.message}`, type: 'error' });
        }
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedKey(text);
            setTimeout(() => setCopiedKey(null), 2000);
        });
    };

    if (!API_BASE_URL) return <div>API URL not configured</div>;

    if (loading && secrets.length === 0) {
        return <div style={{ padding: '20px', color: '#666' }}>Loading secrets...</div>;
    }

    if (error) {
        return (
            <div style={{ padding: '20px', color: 'red', border: '1px solid red', borderRadius: '8px', marginTop: '20px' }}>
                Error loading secrets: {error}
                <button
                    onClick={fetchSecrets}
                    style={{ marginLeft: '10px', padding: '4px 8px', cursor: 'pointer' }}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: 'white' }}>
            <h2 style={{ marginTop: 0 }}>Secrets Vault</h2>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
                Manage API keys and sensitive configuration. Values are encrypted at rest.
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '10px' }}>Key</th>
                        <th style={{ padding: '10px' }}>Status</th>
                        <th style={{ padding: '10px' }}>Value</th>
                        <th style={{ padding: '10px' }}>Updated</th>
                        <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {secrets.map(s => (
                        <tr key={s.key} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold', color: '#333' }}>
                                {s.key}
                                <button
                                    onClick={() => handleCopy(s.key)}
                                    title="Copy Key Name"
                                    style={{
                                        marginLeft: '8px', border: 'none', background: 'none', cursor: 'pointer',
                                        opacity: 0.6, fontSize: '0.8rem'
                                    }}
                                >
                                    {copiedKey === s.key ? '✅' : '📋'}
                                </button>
                            </td>
                            <td style={{ padding: '10px' }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold',
                                    background: s.isSet ? '#e6fffa' : '#fff5f5',
                                    color: s.isSet ? '#047481' : '#c53030',
                                    border: `1px solid ${s.isSet ? '#b2f5ea' : '#feb2b2'}`
                                }}>
                                    {s.isSet ? 'SET' : 'NOT SET'}
                                </span>
                            </td>
                            <td style={{ padding: '10px', fontFamily: 'monospace', color: '#555' }}>
                                {s.masked || '—'}
                            </td>
                            <td style={{ padding: '10px', fontSize: '0.85rem', color: '#888' }}>
                                {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}
                            </td>
                            <td style={{ padding: '10px' }}>
                                {editingKey === s.key ? (
                                    <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                        <input
                                            type="password"
                                            placeholder="Enter new value"
                                            value={newValue}
                                            onChange={e => setNewValue(e.target.value)}
                                            style={{ padding: '4px', width: '140px', border: '1px solid #ccc', borderRadius: '4px' }}
                                        />
                                        <button onClick={() => handleSave(s.key)} style={{ cursor: 'pointer', background: '#3182ce', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>Save</button>
                                        <button onClick={() => { setEditingKey(null); setNewValue(""); }} style={{ cursor: 'pointer', background: '#718096', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px' }}>Cancel</button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button
                                            onClick={() => { setEditingKey(s.key); setNewValue(""); }}
                                            style={{ cursor: 'pointer', background: 'white', border: '1px solid #cbd5e0', color: '#4a5568', padding: '4px 10px', borderRadius: '4px' }}
                                        >
                                            Edit
                                        </button>
                                        {saveStatus?.key === s.key && (
                                            <span style={{ fontSize: '0.8rem', color: saveStatus.type === 'error' ? 'red' : 'green', fontWeight: 'bold' }}>
                                                {saveStatus.msg}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
