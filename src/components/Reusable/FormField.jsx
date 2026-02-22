import React from 'react';

/**
 * Reusable form field component that handles common input types
 * @param {Object} props - Component props
 * @param {string} props.name - Field name for form state binding
 * @param {string} props.label - Label text for the field
 * @param {string} props.type - Input type (text, number, password, email, etc.)
 * @param {string} props.value - Current field value
 * @param {Function} props.onChange - Change handler function
 * @param {boolean} props.required - Whether field is required
 * @param {string} props.placeholder - Placeholder text
 * @param {boolean} props.disabled - Whether field is disabled
 * @param {string} props.error - Error message to display
 * @param {number} props.min - Minimum value for number inputs
 * @param {number} props.max - Maximum value for number inputs
 * @param {number} props.step - Step value for number inputs
 * @param {string} props.className - Additional CSS classes
 * @param {Object} props.inputProps - Additional props to pass to input element
 */
const FormField = ({
  name,
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  placeholder = '',
  disabled = false,
  error = '',
  min,
  max,
  step,
  className = '',
  inputProps = {}
}) => {
  const handleChange = (e) => {
    // Handle numeric inputs with proper validation
    if (type === 'number' && e.target.value !== '') {
      const numValue = parseFloat(e.target.value);
      if (min !== undefined && numValue < min) return;
      if (max !== undefined && numValue > max) return;
    }
    
    onChange(e);
  };

  const inputType = type === 'select' ? 'select' : 
                   type === 'textarea' ? 'textarea' : 'input';

  return (
    <div className={`form-field ${className} ${error ? 'has-error' : ''}`}>
      {label && (
        <label htmlFor={name} className="form-label">
          {label}
          {required && <span className="required-indicator">*</span>}
        </label>
      )}
      
      {inputType === 'select' ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          required={required}
          disabled={disabled}
          className="form-control"
          {...inputProps}
        >
          {inputProps.children}
        </select>
      ) : inputType === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className="form-control"
          {...inputProps}
        />
      ) : (
        <input
          type={type}
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          className="form-control"
          {...inputProps}
        />
      )}
      
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default FormField;