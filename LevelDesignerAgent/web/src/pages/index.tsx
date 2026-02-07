export * from './DesignPage';
export * from './RunPage';

import { AssetBrowser } from '../components/library/AssetBrowser';

export function LibraryPage() {
    return (
        <div style={{ height: '100%', overflowY: 'auto', padding: '20px' }}>
            <h2>Library</h2>
            <AssetBrowser />
        </div>
    );
}

import { SecretsAdmin } from '../SecretsAdmin';

export function AdminPage({ onSessionExpired }: { onSessionExpired: () => void }) {
    return (
        <div style={{ padding: '20px' }}>
            <h2>Admin</h2>
            <SecretsAdmin onSessionExpired={onSessionExpired} />
        </div>
    );
}
