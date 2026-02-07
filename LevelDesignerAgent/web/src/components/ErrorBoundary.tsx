
import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;
            return (
                <div style={{ color: 'red', padding: '20px', border: '1px solid red', background: '#330000' }}>
                    <h3>Something went wrong.</h3>
                    <pre>{this.state.error?.message}</pre>
                    <button onClick={() => this.setState({ hasError: false, error: null })}>Try again</button>
                </div>
            );
        }

        return this.props.children;
    }
}
