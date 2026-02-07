import { useState } from 'react';
import { AssetBrowser } from '../components/library/AssetBrowser'; // Keeping for reference if needed, but not using
import { RunGallery } from '../components/library/RunGallery';
import { RunDetail } from '../components/run/RunDetail';
import { SecretsAdmin } from '../SecretsAdmin';

export * from './DesignPage';
export * from './RunPage';

export function LibraryPage() {
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

    // If detail view is open
    if (selectedRunId) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
                    <button
                        onClick={() => setSelectedRunId(null)}
                        style={{
                            background: 'none',
                            border: '1px solid #444',
                            color: '#ccc',
                            padding: '6px 12px',
                            cursor: 'pointer',
                            borderRadius: '4px'
                        }}
                    >
                        ← Back to Library
                    </button>
                </div>
                <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                    <RunDetail
                        runId={selectedRunId}
                        onClose={() => setSelectedRunId(null)} // Added to satisfy props if needed, though view change handles it
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Community Runs</h2>
            <RunGallery onRunClick={setSelectedRunId} />
        </div>
    );
}

export function AdminPage({ onSessionExpired }: { onSessionExpired: () => void }) {
    return (
        <div style={{ padding: '20px' }}>
            <h2>Admin</h2>
            <SecretsAdmin onSessionExpired={onSessionExpired} />
        </div>
    );
}
