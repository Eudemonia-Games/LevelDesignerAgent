import React, { useState, useEffect } from 'react';
import { fetchApi } from '../../api';
import { Run, StageRun, RunEvent } from '@lda/shared';
// import { LevelViewer } from './LevelViewer'; // Removed static import
import { ErrorBoundary } from '../ErrorBoundary';

// Lazy load the 3D viewer to prevent 3D-library initialization errors from crashing the whole app at startup
const LevelViewer = React.lazy(() => import('./LevelViewer').then(module => ({ default: module.LevelViewer })));

interface RunDetailProps {
    runId: string;
    onClose: () => void;
}



const safeTime = (value: unknown) => {
    const d = value ? new Date(value as any) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString() : '—';
};

export function RunDetail({ runId, onClose }: RunDetailProps) {
    const [run, setRun] = useState<Run | null>(null);
    const [stages, setStages] = useState<StageRun[]>([]);
    const [events, setEvents] = useState<RunEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [show3D, setShow3D] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        try {
            const [runData, stageData, eventData] = await Promise.all([
                fetchApi(`/api/v1/runs/${runId}`),
                fetchApi(`/api/v1/runs/${runId}/stages`),
                fetchApi(`/api/v1/runs/${runId}/events`)
            ]);
            setRun(runData.run);
            setStages(stageData.stages);
            setEvents(eventData.events);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Unknown error");
        }
    };

    useEffect(() => {
        setLoading(true);
        loadData().finally(() => setLoading(false));

        const interval = setInterval(loadData, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, [runId]);

    if (show3D) {
        return (
            <div style={{ width: '100%', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111' }}>
                <ErrorBoundary fallback={<div style={{ color: 'red', padding: 20 }}>Critical 3D Viewer Error. Check console.</div>}>
                    <React.Suspense fallback={<div style={{ color: 'white' }}>Loading 3D Assets...</div>}>
                        <LevelViewer runId={runId} onClose={() => setShow3D(false)} />
                    </React.Suspense>
                </ErrorBoundary>
            </div>
        );
    }

    if (!run && loading) return <div>Loading detail...</div>;
    if (!run) return (
        <div style={{ padding: '20px', color: 'red' }}>
            <h3>Run not found</h3>
            <p>Could not load run ID: {runId}</p>
            {error && <p>Error: {error}</p>}
            <button onClick={onClose}>Back</button>
        </div>
    );

    return (
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <button onClick={onClose} style={{ marginBottom: '10px' }}>&larr; Back</button>

            <div style={{ marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                <h2>{run.user_prompt}</h2>
                <div>
                    Status: <strong>{run.status}</strong> <br />
                    ID: <span style={{ fontFamily: 'monospace' }}>{run.id}</span>
                    <button style={{
                        marginLeft: '15px',
                        background: '#333',
                        border: '1px solid #555',
                        color: '#eee',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                    }} onClick={() => {
                        window.open(`${import.meta.env.VITE_API_BASE_URL || ''}/api/v1/runs/${run.id}/download`, '_blank');
                    }}>
                        ⬇️ Download Assets
                    </button>
                    <button style={{
                        marginLeft: '10px',
                        background: '#0ea5e9', // Sky blue
                        border: '1px solid #0284c7',
                        color: 'white',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 'bold'
                    }} onClick={() => setShow3D(true)}>
                        cube View 3D
                    </button>
                </div>
                {run.error_summary && (
                    <div style={{ color: 'red', marginTop: '10px' }}>
                        Error: {run.error_summary}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Timeline / Stages */}
                <div>
                    <h3>Stages</h3>
                    {stages.length === 0 && <div>No stages yet.</div>}
                    {stages.map(stage => (
                        <div key={stage.id} style={{
                            padding: '10px', marginBottom: '10px', border: '1px solid #444',
                            borderRadius: '4px',
                            background: stage.status === 'running' ? '#172554' : // blue-950
                                stage.status === 'succeeded' ? '#052e16' : // green-950
                                    stage.status === 'failed' ? '#450a0a' : '#2a2a2a', // red-950 or gray
                            color: '#e0e0e0'
                        }}>
                            <div style={{ fontWeight: 'bold' }}>{stage.stage_key} (Attempt {stage.attempt})</div>
                            <div>Status: {stage.status}</div>
                            {stage.output_json && Object.keys(stage.output_json).length > 0 && (
                                <pre style={{
                                    fontSize: '0.8em',
                                    background: '#1e1e1e',
                                    color: '#d4d4d4',
                                    padding: '5px',
                                    overflowX: 'auto',
                                    marginTop: '5px',
                                    borderRadius: '4px'
                                }}>
                                    {JSON.stringify(stage.output_json, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))}
                </div>

                {/* Events Log */}
                <div>
                    <h3>Events</h3>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #eee', padding: '10px' }}>
                        {events.map(ev => (
                            <div key={ev.id} style={{ marginBottom: '5px', fontSize: '0.9em' }}>
                                <span style={{ color: '#888' }}>{safeTime(ev.created_at)}</span>
                                {' '}
                                <span style={{
                                    fontWeight: 'bold',
                                    color: ev.level === 'error' ? '#ef4444' : ev.level === 'warn' ? '#f59e0b' : '#e5e7eb'
                                }}>
                                    [{ev.level.toUpperCase()}]
                                </span>
                                {' '}
                                {ev.message}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
