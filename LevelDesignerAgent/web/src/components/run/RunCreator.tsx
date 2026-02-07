import { useState, useEffect } from 'react';
import { fetchApi } from '../../api';
import { FlowVersion } from '@lda/shared';

interface RunCreatorProps {
    onRunCreated: (runId: string) => void;
}

export function RunCreator({ onRunCreated }: RunCreatorProps) {
    const [flows, setFlows] = useState<FlowVersion[]>([]);
    const [selectedFlowId, setSelectedFlowId] = useState<string>('');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchApi('/design/flows').then(data => setFlows(data.flows)).catch(console.error);
    }, []);

    const handleSubmit = async () => {
        if (!selectedFlowId || !prompt) return;

        setLoading(true);
        try {
            const res = await fetchApi('/api/v1/runs', {
                method: 'POST',
                body: JSON.stringify({
                    flow_version_id: selectedFlowId,
                    user_prompt: prompt,
                    mode: 'express'
                })
            });
            if (res.run) {
                setPrompt('');
                onRunCreated(res.run.id);
            }
        } catch (err: any) {
            alert(`Failed to start run: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc', background: '#f9f9f9' }}>
            <h3>Start New Run</h3>
            <div style={{ marginBottom: '10px' }}>
                <select
                    value={selectedFlowId}
                    onChange={e => setSelectedFlowId(e.target.value)}
                    style={{ padding: '5px', width: '100%' }}
                >
                    <option value="">-- Select Flow --</option>
                    {flows.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>
            </div>
            <div style={{ marginBottom: '10px' }}>
                <textarea
                    placeholder="Enter your prompt..."
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    style={{ width: '100%', height: '60px', padding: '5px' }}
                />
            </div>
            <button
                onClick={handleSubmit}
                disabled={loading || !selectedFlowId || !prompt}
                style={{ padding: '8px 15px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
            >
                {loading ? 'Starting...' : 'Start Run'}
            </button>
        </div>
    );
}
