import React, { useEffect, useState } from 'react';
import { fetchApi } from '../../api';

interface RunSummary {
    id: string;
    flow_version_id: string;
    status: string;
    user_prompt: string;
    created_at: string;
    updated_at: string;
    // We might want to show a thumbnail? For now just prompt.
}

interface RunGalleryProps {
    onRunClick?: (runId: string, mode: 'details' | '3d') => void;
    isAdmin?: boolean;
}

export function RunGallery({ onRunClick, isAdmin = false }: RunGalleryProps) {
    const [runs, setRuns] = useState<RunSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadRuns();
    }, []);

    const loadRuns = async () => {
        try {
            setLoading(true);
            const data = await fetchApi('/api/v1/runs');
            // Data is { runs: [...] }
            setRuns(data.runs || []);
        } catch (err: any) {
            console.error("Failed to load runs:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ color: '#888' }}>Loading library...</div>;
    if (error) return <div style={{ color: '#f55' }}>Error: {error}</div>;

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
            padding: '20px'
        }}>
            {runs.map(run => (
                <div
                    key={run.id}
                    onClick={() => isAdmin && onRunClick && onRunClick(run.id, 'details')}
                    style={{
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '8px',
                        padding: '16px',
                        cursor: 'default',
                        transition: 'transform 0.2s, border-color 0.2s',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.borderColor = '#666';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.borderColor = '#333';
                        e.currentTarget.style.transform = 'translateY(0)';
                    }}
                >
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        color: '#666'
                    }}>
                        <span>{new Date(run.created_at).toLocaleDateString()}</span>
                        <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: run.status === 'succeeded' ? '#1a3' : run.status === 'failed' ? '#a33' : '#33a',
                            color: '#fff',
                            fontSize: '0.7rem'
                        }}>{run.status.toUpperCase()}</span>
                    </div>

                    <div style={{
                        color: '#eee',
                        fontSize: '1rem',
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '1.4'
                    }}>
                        "{run.user_prompt}"
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', gap: '8px' }}>
                        {/* Admin Only: Details Button */}
                        {isAdmin && (
                            <button style={{
                                flex: 1,
                                background: '#333',
                                border: 'none',
                                color: '#aaa',
                                padding: '8px',
                                cursor: 'pointer',
                                borderRadius: '4px'
                            }} onClick={(e) => {
                                e.stopPropagation();
                                onRunClick && onRunClick(run.id, 'details');
                            }}>
                                Details
                            </button>
                        )}

                        {/* Public & Admin: Load 3D Button */}
                        <button style={{
                            flex: 1,
                            background: '#0ea5e9', // Sky blue
                            border: 'none',
                            color: 'white',
                            padding: '8px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px'
                        }} onClick={(e) => {
                            e.stopPropagation();
                            onRunClick && onRunClick(run.id, '3d');
                        }}>
                            <span>Choose Level</span>
                        </button>

                        {/* Admin Only: Delete Button */}
                        {isAdmin && (
                            <button style={{
                                width: '40px',
                                background: '#422',
                                border: 'none',
                                color: '#d88',
                                padding: '8px',
                                cursor: 'pointer',
                                borderRadius: '4px'
                            }} title="Delete Run" onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm("Are you sure you want to delete this run? This action cannot be undone.")) return;
                                try {
                                    await fetchApi(`/api/v1/runs/${run.id}`, { method: 'DELETE' });
                                    // Optimistic update
                                    setRuns(runs.filter(r => r.id !== run.id));
                                } catch (err: any) {
                                    alert(`Failed to delete: ${err.message}`);
                                }
                            }}>
                                🗑️
                            </button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
