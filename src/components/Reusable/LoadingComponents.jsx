import React from 'react';

/**
 * Reusable loading spinner component
 * @param {Object} props - Component props
 * @param {string} props.size - Size of spinner (small, medium, large)
 * @param {string} props.color - Color of spinner
 * @param {string} props.message - Loading message to display
 * @param {boolean} props.fullScreen - Whether to show as full screen overlay
 * @param {string} props.className - Additional CSS classes
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  color = 'primary',
  message = '',
  fullScreen = false,
  className = '' 
}) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  const colorClasses = {
    primary: 'text-blue-500',
    secondary: 'text-gray-500',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    error: 'text-red-500'
  };

  const spinner = (
    <div className={`loading-spinner ${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
      <div className="spinner-ring"></div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          {spinner}
          {message && <p className="loading-message">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="loading-container">
      {spinner}
      {message && <span className="loading-text">{message}</span>}
    </div>
  );
};

/**
 * Reusable error banner component
 * @param {Object} props - Component props
 * @param {string} props.message - Error message to display
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.dismissible - Whether error can be dismissed
 * @param {string} props.className - Additional CSS classes
 */
export const ErrorBanner = ({ 
  message, 
  onClose, 
  dismissible = true,
  className = '' 
}) => {
  return (
    <div className={`error-banner ${className}`}>
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <span className="error-message">{message}</span>
        {dismissible && onClose && (
          <button 
            className="error-close" 
            onClick={onClose}
            aria-label="Close error message"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Reusable success banner component
 * @param {Object} props - Component props
 * @param {string} props.message - Success message to display
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.dismissible - Whether success message can be dismissed
 * @param {number} props.autoDismiss - Auto-dismiss timeout in milliseconds
 * @param {string} props.className - Additional CSS classes
 */
export const SuccessBanner = ({ 
  message, 
  onClose, 
  dismissible = true,
  autoDismiss = 0,
  className = '' 
}) => {
  React.useEffect(() => {
    if (autoDismiss > 0 && onClose) {
      const timer = setTimeout(onClose, autoDismiss);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onClose]);

  return (
    <div className={`success-banner ${className}`}>
      <div className="success-content">
        <span className="success-icon">✓</span>
        <span className="success-message">{message}</span>
        {dismissible && onClose && (
          <button 
            className="success-close" 
            onClick={onClose}
            aria-label="Close success message"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Reusable confirmation dialog component
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether dialog is open
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Confirmation message
 * @param {Function} props.onConfirm - Confirm handler
 * @param {Function} props.onCancel - Cancel handler
 * @param {string} props.confirmText - Confirm button text
 * @param {string} props.cancelText - Cancel button text
 * @param {boolean} props.loading - Loading state
 */
export const ConfirmDialog = ({ 
  isOpen, 
  title, 
  message, 
  onConfirm, 
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button 
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button 
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;