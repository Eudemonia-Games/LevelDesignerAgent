import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './Login';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DesignPage, RunPage, LibraryPage, AdminPage } from './pages';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

    const checkAuth = () => {
        if (!API_BASE_URL) {
            console.warn("VITE_API_BASE_URL not set.");
            setIsAuthenticated(false);
            return;
        }

        fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
            .then(res => {
                if (res.ok) setIsAuthenticated(true);
                else setIsAuthenticated(false);
            })
            .catch(() => setIsAuthenticated(false));
    };

    useEffect(() => {
        checkAuth();
    }, []);

    const handleLogout = async () => {
        if (!API_BASE_URL) {
            setIsAuthenticated(false);
            return;
        }
        try {
            await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include'
            });
        } catch (err) {
            console.error("Logout failed", err);
        } finally {
            setIsAuthenticated(false);
        }
    };

    // Loading state
    if (isAuthenticated === null) {
        return <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>Loading...</div>;
    }

    // Authenticated Context
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<AppShell onLogout={isAuthenticated ? handleLogout : () => window.location.reload()} isAuthenticated={isAuthenticated} />}>
                    {/* Public Routes */}
                    <Route path="library" element={<LibraryPage isAdmin={!!isAuthenticated} />} />

                    {/* Protected Routes */}
                    {isAuthenticated ? (
                        <>
                            <Route index element={<Navigate to="/design" replace />} />
                            <Route path="design" element={<DesignPage />} />
                            <Route path="run" element={
                                <ErrorBoundary fallback={<div style={{ padding: 20, color: 'white' }}>Run UI Crashed. Check console.</div>}>
                                    <RunPage />
                                </ErrorBoundary>
                            } />
                            <Route path="admin" element={<AdminPage onSessionExpired={() => setIsAuthenticated(false)} />} />
                        </>
                    ) : (
                        <>
                            {/* Guest Routes - Redirect root to Library */}
                            <Route index element={<Navigate to="/library" replace />} />
                            <Route path="login" element={<Login onLoginSuccess={() => setIsAuthenticated(true)} />} />

                            {/* Redirect others to Login */}
                            <Route path="*" element={<Navigate to="/login" replace />} />
                        </>
                    )}
                </Route>
            </Routes>
        </BrowserRouter>
    );
}

export default App;
