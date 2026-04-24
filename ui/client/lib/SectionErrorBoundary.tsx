import React from "react";

interface State {
    error: Error | null;
}

interface Props {
    admin: boolean;
    sectionId?: string;
    children: React.ReactNode;
}

/**
 * Isolates render failures of a single section so a bad content payload
 * doesn't take down the whole page. In admin view shows a small diagnostic;
 * in public view renders nothing.
 */
export default class SectionErrorBoundary extends React.Component<Props, State> {
    state: State = {error: null};

    static getDerivedStateFromError(error: Error): State {
        return {error};
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[section] render failed', {sectionId: this.props.sectionId, error, info});
    }

    render() {
        if (!this.state.error) return this.props.children;
        if (!this.props.admin) return null;
        return (
            <div style={{
                padding: 12,
                margin: '8px 0',
                border: '1px dashed #faad14',
                background: '#fffbe6',
                color: '#874d00',
                fontSize: 13,
            }}>
                <strong>Section failed to render.</strong>{' '}
                {this.props.sectionId ? <code>id={this.props.sectionId}</code> : null}
                <div style={{opacity: 0.8, marginTop: 4}}>{this.state.error.message}</div>
            </div>
        );
    }
}
