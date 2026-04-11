import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to the console for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/'; // Redirect to home to clear stale state
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          fontFamily: 'Lexend Deca, sans-serif',
          padding: '20px'
        }}>
          <h1 style={{ color: '#01538b' }}>Oops! Something went wrong.</h1>
          <p style={{ color: '#64748b', maxWidth: '500px' }}>
            The application encountered an unexpected error. Don't worry, your data is safe.
          </p>
          <button
            onClick={this.handleReset} // Fixed: Added 'this.' prefix
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              backgroundColor: '#01538b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontFamily: 'inherit'
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