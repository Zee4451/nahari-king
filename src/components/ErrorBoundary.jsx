import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
          <h2>Something went wrong.</h2>
          <div style={{ 
            textAlign: 'left', 
            background: '#ffebee', 
            color: '#c62828', 
            padding: '1rem', 
            borderRadius: '8px', 
            marginTop: '1rem',
            marginBottom: '1rem',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            <strong>Error:</strong> {this.state.error?.toString()}
            <br /><br />
            <strong>Stack:</strong>
            <br />
            {this.state.error?.stack}
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
