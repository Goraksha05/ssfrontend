// src/components/ErrorBoundary.js
//
// Improvements:
//   • Reset button lets users recover without a full page reload
//   • Optional onError prop for external error reporting (Sentry, etc.)
//   • Optional fallback prop for custom UI
//   • Resets state when children change (key-based reset support)

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    // Optional external error reporting
    this.props.onError?.(error, errorInfo);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Custom fallback
    if (this.props.fallback) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : this.props.fallback;
    }

    // Default fallback
    return (
      <div
        style={{
          padding:      '24px',
          textAlign:    'center',
          background:   '#fff8f8',
          border:       '1px solid #fca5a5',
          borderRadius: '12px',
          margin:       '16px',
        }}
        role="alert"
      >
        <h3 style={{ color: '#dc2626', marginBottom: '8px' }}>Something went wrong</h3>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={this.reset}
          style={{
            padding:      '8px 20px',
            background:   '#3b82f6',
            color:        '#fff',
            border:       'none',
            borderRadius: '8px',
            cursor:       'pointer',
            fontWeight:   600,
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;