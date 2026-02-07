import { useState } from 'react';
import { FlowSelector } from '../components/design/FlowSelector';
import { StageList } from '../components/design/StageList';
import { StageDetail } from '../components/design/StageDetail';

export function DesignPage() {
    const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
    const [selectedStageKey, setSelectedStageKey] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleSelectFlow = (id: string) => {
        setSelectedFlowId(id);
        setSelectedStageKey(null);
    };

    const handleStageSaved = () => {
        setRefreshTrigger(p => p + 1); // Reload list
        setSelectedStageKey(null); // Deselect to match list refresh or could keep it.
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <FlowSelector selectedFlowId={selectedFlowId} onSelectFlow={handleSelectFlow} />

            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                <div style={{ width: '300px', borderRight: '1px solid #ddd', overflowY: 'auto' }}>
                    <StageList
                        flowId={selectedFlowId || ''}
                        selectedStageKey={selectedStageKey}
                        onSelectStage={setSelectedStageKey}
                        refreshTrigger={refreshTrigger}
                    />
                </div>
                <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                    {selectedFlowId && selectedStageKey ? (
                        <StageDetail
                            flowId={selectedFlowId}
                            stageKey={selectedStageKey}
                            onSaved={handleStageSaved}
                            onCancel={() => setSelectedStageKey(null)}
                        />
                    ) : (
                        <div style={{ padding: '20px', color: '#888' }}>
                            {selectedFlowId ? 'Select a stage to edit' : 'Select a flow to get started'}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
