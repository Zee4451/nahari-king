import { useState, useCallback } from 'react';

/**
 * Custom hook for managing API operation states
 * Handles loading, success, and error states with automatic cleanup
 * @param {Function} apiFunction - The API function to call
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoReset - Whether to auto-reset success/error after timeout
 * @param {number} options.resetTimeout - Timeout in ms for auto-reset
 * @param {Function} options.onSuccess - Callback for successful operations
 * @param {Function} options.onError - Callback for error operations
 * @returns {Object} Operation state and handlers
 */
export const useApiOperation = (apiFunction, options = {}) => {
  const {
    autoReset = true,
    resetTimeout = 3000,
    onSuccess,
    onError
  } = options;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Auto-reset timers
  const resetTimer = useCallback(() => {
    if (autoReset && (success || error)) {
      const timer = setTimeout(() => {
        setSuccess('');
        setError('');
      }, resetTimeout);
      return () => clearTimeout(timer);
    }
  }, [autoReset, resetTimeout, success, error]);

  // Reset states manually
  const resetStates = useCallback(() => {
    setLoading(false);
    setError('');
    setSuccess('');
  }, []);

  // Execute API operation
  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await apiFunction(...args);
      setSuccess('Operation completed successfully!');
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'An error occurred';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction, onSuccess, onError]);

  // Reset timer effect
  resetTimer();

  return {
    loading,
    error,
    success,
    execute,
    resetStates,
    setError,
    setSuccess
  };
};

/**
 * Custom hook for managing confirmation dialogs
 * @param {Function} onConfirm - Function to call when confirmed
 * @param {string} confirmationMessage - Message to show in confirmation dialog
 * @returns {Object} Confirmation state and handlers
 */
export const useConfirmation = (onConfirm, confirmationMessage = 'Are you sure?') => {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirm]);

  const requestConfirmation = useCallback(() => {
    if (window.confirm(confirmationMessage)) {
      handleConfirm();
    }
  }, [confirmationMessage, handleConfirm]);

  return {
    isConfirming,
    requestConfirmation,
    handleConfirm
  };
};

/**
 * Custom hook for managing form submission with loading states
 * @param {Function} onSubmit - Form submission handler
 * @param {Object} options - Configuration options
 * @returns {Object} Form submission state and handlers
 */
export const useFormSubmission = (onSubmit, options = {}) => {
  const {
    successMessage = 'Form submitted successfully!',
    errorMessage = 'Failed to submit form',
    resetOnSuccess = true,
    onBeforeSubmit,
    onAfterSubmit
  } = options;

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  const handleSubmit = useCallback(async (formData) => {
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');

    try {
      if (onBeforeSubmit) {
        await onBeforeSubmit(formData);
      }

      const result = await onSubmit(formData);
      
      setSubmitSuccess(successMessage);
      
      if (resetOnSuccess) {
        // Reset form logic would go here
      }

      if (onAfterSubmit) {
        await onAfterSubmit(result, formData);
      }

      return result;
    } catch (error) {
      const errorMsg = error.message || errorMessage;
      setSubmitError(errorMsg);
      throw error;
    } finally {
      setSubmitting(false);
    }
  }, [onSubmit, successMessage, errorMessage, resetOnSuccess, onBeforeSubmit, onAfterSubmit]);

  const clearMessages = useCallback(() => {
    setSubmitError('');
    setSubmitSuccess('');
  }, []);

  return {
    submitting,
    submitError,
    submitSuccess,
    handleSubmit,
    clearMessages
  };
};

/**
 * Custom hook for managing data fetching with loading states
 * @param {Function} fetchData - Function to fetch data
 * @param {Array} dependencies - Dependencies for useEffect
 * @param {Object} options - Configuration options
 * @returns {Object} Data fetching state and handlers
 */
export const useDataFetching = (fetchData, dependencies = [], options = {}) => {
  const {
    autoFetch = true,
    onError,
    onSuccess,
    initialData = null
  } = options;

  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState('');

  const fetchDataWrapper = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const result = await fetchData();
      setData(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (err) {
      const errorMessage = err.message || 'Failed to fetch data';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }
      
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchData, onSuccess, onError]);

  // Auto-fetch on mount if enabled
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const effectDependencies = autoFetch ? [...dependencies, fetchDataWrapper] : dependencies;
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const autoFetchCallback = useCallback(() => {
    if (autoFetch) {
      fetchDataWrapper();
    }
  }, effectDependencies);

  return {
    data,
    loading,
    error,
    refetch: fetchDataWrapper,
    setData
  };
};

export default {
  useApiOperation,
  useConfirmation,
  useFormSubmission,
  useDataFetching
};