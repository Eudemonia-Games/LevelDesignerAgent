import { useState, useEffect } from 'react';
import { fetchApi } from '../../api';
import { FlowStageTemplate } from '@lda/shared';

interface StageListProps {
    flowId: string;
    selectedStageKey: string | null;
    onSelectStage: (stageKey: string) => void;
    refreshTrigger: number; // to force reload
}

export function StageList({ flowId, selectedStageKey, onSelectStage, refreshTrigger }: StageListProps) {
    const [stages, setStages] = useState<FlowStageTemplate[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!flowId) {
            setStages([]);
            return;
        }

        const load = async () => {
            setLoading(true);
            try {
                const data = await fetchApi(`/design/flows/${flowId}/stages`);
                // Sort by order_index
                const sorted = (data.stages as FlowStageTemplate[]).sort((a, b) => a.order_index - b.order_index);
                setStages(sorted);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [flowId, refreshTrigger]);

    if (!flowId) return <div style={{ padding: '10px', color: '#888' }}>Select a flow</div>;
    if (loading) return <div style={{ padding: '10px' }}>Loading stages...</div>;

    return (
        <div style={{ padding: '10px' }}>
            <h3>Stages</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {stages.map(stage => (
                    <li
                        key={stage.stage_key}
                        onClick={() => onSelectStage(stage.stage_key)}
                        style={{
                            padding: '8px',
                            border: '1px solid #ddd',
                            marginBottom: '5px',
                            cursor: 'pointer',
                            background: selectedStageKey === stage.stage_key ? '#e0f0ff' : 'white',
                            fontWeight: selectedStageKey === stage.stage_key ? 'bold' : 'normal'
                        }}
                    >
                        {stage.order_index}. {stage.stage_key} <br />
                        <span style={{ fontSize: '0.8em', color: '#666' }}>{stage.provider} / {stage.kind}</span>
                    </li>
                ))}
            </ul>
            <div style={{ marginTop: '10px' }}>
                <button onClick={() => onSelectStage('__NEW__')}>+ Add Stage</button>
            </div>
        </div>
    );
}
