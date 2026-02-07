import { useState, useEffect } from 'react';
import { fetchApi } from '../../api';
import { Asset } from '@lda/shared';

export function AssetBrowser() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(false);
    const [filterKind, setFilterKind] = useState<string>('');

    const loadAssets = async () => {
        setLoading(true);
        try {
            const query = filterKind ? `?kind=${filterKind}` : '';
            const data = await fetchApi(`/api/v1/assets${query}`);
            setAssets(data.assets);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssets();
    }, [filterKind]);

    return (
        <div style={{ padding: '10px' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <select value={filterKind} onChange={e => setFilterKind(e.target.value)} style={{ padding: '5px' }}>
                    <option value="">All Kinds</option>
                    <option value="prompt_text">Prompts</option>
                    <option value="grid_image">Grid Images</option>
                    <option value="tile_model_source">Tile Models</option>
                    <option value="exterior_model_source">Exterior Models</option>
                </select>
                <button onClick={loadAssets}>Refresh</button>
            </div>

            {loading && <div>Loading assets...</div>}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {assets.map(asset => (
                    <div key={asset.id} style={{ border: '1px solid #ddd', padding: '10px', borderRadius: '4px', background: 'white' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9em', marginBottom: '5px' }}>{asset.kind}</div>

                        {/* Thumbnail Placeholder */}
                        <div style={{
                            height: '150px', background: '#f0f0f0', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', marginBottom: '10px',
                            overflow: 'hidden'
                        }}>
                            {(asset.kind.includes('image')) ? (
                                <AssetThumbnail assetId={asset.id} />
                            ) : (
                                <div style={{ color: '#aaa' }}>{asset.kind}</div>
                            )}
                        </div>

                        <div style={{ fontSize: '0.8em', color: '#666' }}>
                            {new Date(asset.created_at).toLocaleDateString()}
                        </div>
                        <div style={{ fontSize: '0.8em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {asset.slug || asset.id}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AssetThumbnail({ assetId }: { assetId: string }) {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        fetchApi(`/api/v1/assets/${assetId}/url`)
            .then(data => setUrl(data.url))
            .catch(() => { });
    }, [assetId]);

    if (!url) return <span>Loading...</span>;
    return <img src={url} alt="Asset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}
