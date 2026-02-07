import { Outlet, Link, useLocation } from 'react-router-dom';

interface AppShellProps {
    onLogout: () => void;
    isAuthenticated: boolean;
}

export function AppShell({ onLogout, isAuthenticated }: AppShellProps) {
    const location = useLocation();

    const allNavItems = [
        { path: '/design', label: 'Design', protected: true },
        { path: '/run', label: 'Run', protected: true },
        { path: '/library', label: 'Library', protected: false },
        { path: '/admin', label: 'Admin', protected: true },
    ];

    const navItems = allNavItems.filter(item => !item.protected || isAuthenticated);

    return (
        <div style={{ display: 'flex', height: '100vh', flexDirection: 'column', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
            {/* Top Bar */}
            <header style={{
                background: 'var(--color-bg-panel)', color: 'var(--color-text-primary)', padding: '0 20px',
                height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: '1px solid var(--color-border)'
            }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--color-accent)' }}>LDA Level Designer</div>
                {isAuthenticated ? (
                    <button
                        onClick={onLogout}
                        style={{
                            background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)', border: 'none',
                            padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'
                        }}
                    >
                        Logout
                    </button>
                ) : (
                    <Link to="/login">
                        <button
                            style={{
                                background: 'var(--color-accent)', color: 'white', border: 'none',
                                padding: '5px 10px', borderRadius: '4px', cursor: 'pointer'
                            }}
                        >
                            Login
                        </button>
                    </Link>
                )}
            </header>

            <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
                {/* Sidebar */}
                <aside style={{ width: '200px', background: 'var(--color-bg-panel)', borderRight: '1px solid var(--color-border)', padding: '20px 0' }}>
                    <nav>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {navItems.map(item => {
                                const isActive = location.pathname.startsWith(item.path);
                                return (
                                    <li key={item.path} style={{ marginBottom: '5px' }}>
                                        <Link
                                            to={item.path}
                                            style={{
                                                display: 'block', padding: '10px 20px',
                                                textDecoration: 'none',
                                                color: isActive ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                                                background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                                                fontWeight: isActive ? 'bold' : 'normal',
                                                borderLeft: isActive ? '3px solid var(--color-accent)' : '3px solid transparent'
                                            }}
                                        >
                                            {item.label}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>
                </aside>

                {/* Main Content */}
                <main style={{ flexGrow: 1, overflow: 'auto', padding: '0' }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
