import { Component } from 'react';

/** Catches rendering errors so one broken widget never leaves a blank screen. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal" role="alert">
        <h1>Something went wrong</h1>
        <p>{String(this.state.error.message || this.state.error)}</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
