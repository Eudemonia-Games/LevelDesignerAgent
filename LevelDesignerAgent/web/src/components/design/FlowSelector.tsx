import { useState, useEffect } from 'react';
import { fetchApi } from '../../api';
import { FlowVersion } from '@lda/shared';

interface FlowSelectorProps {
    selectedFlowId: string | null;
    onSelectFlow: (flowId: string) => void;
}

export function FlowSelector({ selectedFlowId, onSelectFlow }: FlowSelectorProps) {
    const [flows, setFlows] = useState<FlowVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadFlows = async () => {
        setLoading(true);
        try {
            const data = await fetchApi('/design/flows');
            setFlows(data.flows);
            setError(null);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFlows();
    }, []);

    const handleCreate = async () => {
        const name = prompt("Enter Flow Name:");
        if (!name) return;

        try {
            const res = await fetchApi('/design/flows', {
                method: 'POST',
                body: JSON.stringify({
                    name,
                    version_major: 0,
                    version_minor: 1,
                    version_patch: 0,
                    description: 'New Flow'
                })
            });
            await loadFlows();
            if (res.flow) {
                onSelectFlow(res.flow.id);
            }
        } catch (err: any) {
            alert(`Failed to create flow: ${err.message}`);
        }
    };

    return (
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <label><strong>Flow:</strong></label>
            {loading ? (
                <span>Loading...</span>
            ) : error ? (
                <span style={{ color: 'red' }}>Error: {error}</span>
            ) : (
                <select
                    value={selectedFlowId || ''}
                    onChange={(e) => onSelectFlow(e.target.value)}
                    style={{ padding: '5px' }}
                >
                    <option value="">-- Select Flow --</option>
                    {flows.map(f => (
                        <option key={f.id} value={f.id}>
                            {f.name} (v{f.version_major}.{f.version_minor}.{f.version_patch})
                        </option>
                    ))}
                </select>
            )}
            <button onClick={handleCreate} style={{ padding: '5px 10px' }}>+ New Flow</button>
        </div>
    );
}
