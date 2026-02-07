import { useState, useEffect } from 'react';
import { fetchApi } from '../../api';
import { Run } from '@lda/shared';

interface RunListProps {
    onSelectRun: (runId: string) => void;
    refreshTrigger: number;
}

export function RunList({ onSelectRun, refreshTrigger }: RunListProps) {
    const [runs, setRuns] = useState<Run[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                // TODO: Pagination support in props?
                const data = await fetchApi('/api/v1/runs?limit=20');
                setRuns(data.runs);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [refreshTrigger]);

    if (loading && runs.length === 0) return <div>Loading runs...</div>;

    return (
        <div style={{ padding: '10px' }}>
            <h3>Recent Runs</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {runs.map(run => (
                    <li
                        key={run.id}
                        onClick={() => onSelectRun(run.id)}
                        style={{
                            padding: '10px', border: '1px solid #eee', marginBottom: '5px',
                            cursor: 'pointer', background: 'white'
                        }}
                    >
                        <div style={{ fontWeight: 'bold' }}>{run.user_prompt.substring(0, 50)}...</div>
                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                            Status: <span style={{ fontWeight: 'bold' }}>{run.status}</span> |
                            Stage: {run.current_stage_key || '-'} |
                            Created: {new Date(run.created_at).toLocaleString()}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}
