import React from 'react';

/**
 * Global error boundary.
 *
 * Special case — ChunkLoadError:
 *   Happens when Cloudflare (or any CDN) serves index.html instead of a JS/CSS
 *   chunk, usually because a stale redirect rule was active during the previous
 *   deployment. The chunk file now exists on the server but the browser has
 *   cached a bad HTML response for its URL.
 *
 *   Recovery: force a full page reload once. The reload bypasses the browser
 *   cache (`location.reload(true)`) and fetches fresh assets. We store a flag
 *   in sessionStorage so we only auto-reload once per session and never loop.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, isChunkError: false };
  }

  static getDerivedStateFromError(error) {
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk');

    return { hasError: true, error, isChunkError };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Auto-recover from ChunkLoadErrors with a single forced reload.
    const isChunkError =
      error?.name === 'ChunkLoadError' ||
      error?.message?.includes('Loading chunk') ||
      error?.message?.includes('Loading CSS chunk');

    if (isChunkError) {
      const alreadyReloaded = sessionStorage.getItem('chunk_error_reloaded');
      if (!alreadyReloaded) {
        sessionStorage.setItem('chunk_error_reloaded', 'true');
        // force=true bypasses the browser's HTTP cache for this reload
        window.location.reload(true);
      }
    }
  }

  handleReset = () => {
    sessionStorage.removeItem('chunk_error_reloaded');
    this.setState({ hasError: false, error: null, isChunkError: false });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // While a chunk-error reload is in-flight, show a neutral loading screen
      // instead of the scary error message.
      if (this.state.isChunkError && !sessionStorage.getItem('chunk_error_reloaded_shown')) {
        sessionStorage.setItem('chunk_error_reloaded_shown', 'true');
        return (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100vh', textAlign: 'center',
            backgroundColor: '#f8fafc', fontFamily: 'Lexend Deca, sans-serif',
          }}>
            <p style={{ color: '#01538b', fontSize: '18px', fontWeight: 600 }}>
              Refreshing…
            </p>
          </div>
        );
      }

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', textAlign: 'center',
          backgroundColor: '#f8fafc', fontFamily: 'Lexend Deca, sans-serif',
          padding: '20px',
        }}>
          <h1 style={{ color: '#01538b' }}>Oops! Something went wrong.</h1>
          <p style={{ color: '#64748b', maxWidth: '500px' }}>
            The application encountered an unexpected error. Don't worry, your data is safe.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              marginTop: '20px', padding: '12px 24px',
              backgroundColor: '#01538b', color: 'white',
              border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: '600', fontFamily: 'inherit',
            }}
          >
            Back to Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;