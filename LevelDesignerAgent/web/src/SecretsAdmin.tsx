import { useState, useEffect } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface SecretItem {
    key: string;
    isSet: boolean;
    masked: string | null;
    updatedAt: string | null;
}

export function SecretsAdmin() {
    const [secrets, setSecrets] = useState<SecretItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [newValue, setNewValue] = useState("");
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    const fetchSecrets = () => {
        setLoading(true);
        fetch(`${API_BASE_URL}/admin/secrets`, { credentials: 'include' })
            .then(res => {
                if (!res.ok) throw new Error("Failed to fetch secrets");
                return res.json();
            })
            .then(data => {
                setSecrets(data.secrets);
                setError(null);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (API_BASE_URL) fetchSecrets();
    }, []);

    const handleSave = async (key: string) => {
        setSaveStatus("Saving...");
        try {
            const res = await fetch(`${API_BASE_URL}/admin/secrets/${key}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ value: newValue })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save");
            }

            setSaveStatus("Saved!");
            setNewValue("");
            setEditingKey(null);
            fetchSecrets(); // Refresh list
            setTimeout(() => setSaveStatus(null), 2000);
        } catch (err: any) {
            setSaveStatus(`Error: ${err.message}`);
        }
    };

    if (!API_BASE_URL) return <div>API URL not configured</div>;
    if (loading && secrets.length === 0) return <div>Loading secrets...</div>;
    if (error) return <div>Error loading secrets: {error}</div>;

    return (
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Secrets Vault</h2>
            <div style={{ fontSize: '0.9rem', color: '#666', marginBottom: '15px' }}>
                Manage API keys and sensitive configuration. Values are encrypted at rest.
            </div>

            {saveStatus && <div style={{ marginBottom: '10px', fontWeight: 'bold', color: saveStatus.includes('Error') ? 'red' : 'green' }}>{saveStatus}</div>}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
                            <td style={{ padding: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}>{s.key}</td>
                            <td style={{ padding: '10px' }}>
                                <span style={{
                                    padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem',
                                    background: s.isSet ? '#e6fffa' : '#fff5f5',
                                    color: s.isSet ? '#047481' : '#c53030'
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
                                    <div style={{ display: 'flex', gap: '5px' }}>
                                        <input
                                            type="password"
                                            placeholder="Enter new value"
                                            value={newValue}
                                            onChange={e => setNewValue(e.target.value)}
                                            style={{ padding: '4px', width: '150px' }}
                                        />
                                        <button onClick={() => handleSave(s.key)} style={{ cursor: 'pointer', background: '#3182ce', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>Save</button>
                                        <button onClick={() => { setEditingKey(null); setNewValue(""); }} style={{ cursor: 'pointer', background: '#718096', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px' }}>Cancel</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setEditingKey(s.key); setNewValue(""); }}
                                        style={{ cursor: 'pointer', background: 'transparent', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px' }}
                                    >
                                        Edit
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
