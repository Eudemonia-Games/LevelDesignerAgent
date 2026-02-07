import { useState } from 'react';
import { AssetBrowser } from '../components/library/AssetBrowser'; // Keeping for reference if needed, but not using
import { RunGallery } from '../components/library/RunGallery';
import { RunDetail } from '../components/run/RunDetail';
import { SecretsAdmin } from '../SecretsAdmin';

export * from './DesignPage';
export * from './RunPage';

export function LibraryPage({ isAdmin = false }: { isAdmin?: boolean }) {
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
    const [startIn3D, setStartIn3D] = useState(false);

    // If detail view is open
    if (selectedRunId) {
        return (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
                    <button
                        onClick={() => {
                            setSelectedRunId(null);
                            setStartIn3D(false);
                        }}
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
                        onClose={() => {
                            setSelectedRunId(null);
                            setStartIn3D(false);
                        }}
                        initial3D={startIn3D}
                    />
                </div>
            </div>
        );
    }

    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
            <h2 style={{ marginBottom: '20px' }}>Community Levels</h2>
            <RunGallery
                isAdmin={isAdmin}
                onRunClick={(runId, mode) => {
                    setSelectedRunId(runId);
                    setStartIn3D(mode === '3d');
                }}
            />
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
