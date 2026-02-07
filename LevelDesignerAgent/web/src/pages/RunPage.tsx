import { useState } from 'react';
import { RunList } from '../components/run/RunList';
import { RunCreator } from '../components/run/RunCreator';
import { RunDetail } from '../components/run/RunDetail';

export function RunPage() {
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const handleRunCreated = (runId: string) => {
        setRefreshTrigger(p => p + 1);
        setSelectedRunId(runId);
    };

    if (selectedRunId) {
        return <RunDetail runId={selectedRunId} onClose={() => setSelectedRunId(null)} />;
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px' }}>
            <div style={{ marginBottom: '20px' }}>
                <RunCreator onRunCreated={handleRunCreated} />
            </div>
            <div style={{ flexGrow: 1, overflowY: 'auto' }}>
                <RunList onSelectRun={setSelectedRunId} refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
}
