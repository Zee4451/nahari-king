import React, { useState, useCallback } from 'react';
import FormField from './FormField';

/**
 * Custom hook for managing form state with validation
 * @param {Object} initialValues - Initial form values
 * @param {Object} validationRules - Validation rules for each field
 * @returns {Object} Form state and handlers
 */
export const useForm = (initialValues, validationRules = {}) => {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Handle field changes
  const handleChange = useCallback((e) => {
    const { name, value, type, checked } = e.target;
    const fieldValue = type === 'checkbox' ? checked : value;
    
    setValues(prev => ({
      ...prev,
      [name]: fieldValue
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  }, [errors]);

  // Handle field blur (for validation)
  const handleBlur = useCallback((e) => {
    const { name } = e.target;
    setTouched(prev => ({
      ...prev,
      [name]: true
    }));
    
    // Validate the field
    if (validationRules[name]) {
      const error = validateField(name, values[name], validationRules[name]);
      setErrors(prev => ({
        ...prev,
        [name]: error
      }));
    }
  }, [values, validationRules]);

  // Validate a single field
  const validateField = (name, value, rules) => {
    if (!rules) return '';

    // Required validation
    if (rules.required && (!value || value.toString().trim() === '')) {
      return rules.requiredMessage || `${name} is required`;
    }

    // Minimum length validation
    if (rules.minLength && value && value.toString().length < rules.minLength) {
      return rules.minLengthMessage || `${name} must be at least ${rules.minLength} characters`;
    }

    // Maximum length validation
    if (rules.maxLength && value && value.toString().length > rules.maxLength) {
      return rules.maxLengthMessage || `${name} must be no more than ${rules.maxLength} characters`;
    }

    // Pattern validation
    if (rules.pattern && value && !rules.pattern.test(value)) {
      return rules.patternMessage || `${name} format is invalid`;
    }

    // Custom validation
    if (rules.custom && value) {
      const customError = rules.custom(value);
      if (customError) return customError;
    }

    return '';
  };

  // Validate entire form
  const validateForm = useCallback(() => {
    const newErrors = {};
    let isValid = true;

    Object.keys(validationRules).forEach(field => {
      const error = validateField(field, values[field], validationRules[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  }, [values, validationRules]);

  // Reset form
  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  // Set field value programmatically
  const setFieldValue = useCallback((name, value) => {
    setValues(prev => ({
      ...prev,
      [name]: value
    }));
  }, []);

  return {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateForm,
    resetForm,
    setFieldValue,
    setValues
  };
};

/**
 * Reusable form component with built-in validation and submission handling
 * @param {Object} props - Component props
 * @param {Object} props.initialValues - Initial form values
 * @param {Object} props.validationRules - Validation rules for form fields
 * @param {Function} props.onSubmit - Form submission handler
 * @param {Function} props.onCancel - Cancel handler (optional)
 * @param {string} props.submitText - Submit button text
 * @param {string} props.cancelText - Cancel button text
 * @param {boolean} props.loading - Loading state
 * @param {Array} props.fields - Array of field configurations
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.formProps - Additional props for form element
 */
const Form = ({
  initialValues,
  validationRules = {},
  onSubmit,
  onCancel,
  submitText = 'Submit',
  cancelText = 'Cancel',
  loading = false,
  fields = [],
  className = '',
  formProps = {}
}) => {
  const {
    values,
    errors,
    handleChange,
    handleBlur,
    validateForm,
    resetForm
  } = useForm(initialValues, validationRules);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(values);
      resetForm();
    } catch (error) {
      console.error('Form submission error:', error);
    }
  };

  const handleCancel = () => {
    resetForm();
    if (onCancel) onCancel();
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className={`reusable-form ${className}`}
      {...formProps}
    >
      <div className="form-fields">
        {fields.map((field, index) => (
          <FormField
            key={field.name || index}
            name={field.name}
            label={field.label}
            type={field.type}
            value={values[field.name] || ''}
            onChange={handleChange}
            onBlur={handleBlur}
            required={field.required}
            placeholder={field.placeholder}
            disabled={field.disabled || loading}
            error={errors[field.name]}
            min={field.min}
            max={field.max}
            step={field.step}
            className={field.className}
            inputProps={field.inputProps}
          />
        ))}
      </div>
      
      <div className="form-actions">
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Processing...' : submitText}
        </button>
        
        {onCancel && (
          <button 
            type="button" 
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            {cancelText}
          </button>
        )}
      </div>
    </form>
  );
};

export default Form;