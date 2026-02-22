import React, { useState, useEffect } from 'react';
import { 
  register, 
  changePassword, 
  getCurrentUser, 
  isAdmin,
  isAuthenticated
} from '../services/authService';
import Form from './Reusable/Form';
import { ErrorBanner, SuccessBanner } from './Reusable/LoadingComponents';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Validation rules for forms
  const registerValidationRules = {
    email: {
      required: true,
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      patternMessage: 'Please enter a valid email address'
    },
    password: {
      required: true,
      minLength: 8,
      minLengthMessage: 'Password must be at least 8 characters long'
    },
    confirmPassword: {
      required: true,
      custom: (value, formValues) => {
        if (value !== formValues.password) {
          return 'Passwords do not match';
        }
        return '';
      }
    }
  };

  const passwordValidationRules = {
    currentPassword: {
      required: true
    },
    newPassword: {
      required: true,
      minLength: 8,
      minLengthMessage: 'New password must be at least 8 characters long'
    },
    confirmNewPassword: {
      required: true,
      custom: (value, formValues) => {
        if (value !== formValues.newPassword) {
          return 'New passwords do not match';
        }
        return '';
      }
    }
  };

  // Check if user is authenticated and admin
  useEffect(() => {
    if (!isAuthenticated() || !isAdmin()) {
      // This should be handled by route protection, but extra safety
      return;
    }
  }, []);

  const handleRegisterSubmit = async (formData) => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      await register(formData.email, formData.password, formData.role);
      setSuccess('User registered successfully!');
      setShowRegisterForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (formData) => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      await changePassword(formData.currentPassword, formData.newPassword);
      setSuccess('Password changed successfully!');
      setShowChangePasswordForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentUser = getCurrentUser();

  if (!isAuthenticated() || !isAdmin()) {
    return (
      <div className="access-denied-section">
        <h3>Access Denied</h3>
        <p>You don't have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <h2>User Management</h2>
      
      {error && (
        <ErrorBanner 
          message={error} 
          onClose={() => setError('')}
        />
      )}
      
      {success && (
        <SuccessBanner 
          message={success} 
          onClose={() => setSuccess('')}
          autoDismiss={3000}
        />
      )}
      
      <div className="user-actions">
        <button 
          className="btn btn-primary"
          onClick={() => setShowRegisterForm(!showRegisterForm)}
        >
          {showRegisterForm ? 'Cancel Registration' : 'Register New User'}
        </button>
        
        <button 
          className="btn btn-secondary"
          onClick={() => setShowChangePasswordForm(!showChangePasswordForm)}
        >
          {showChangePasswordForm ? 'Cancel Password Change' : 'Change My Password'}
        </button>
      </div>
      
      {showRegisterForm && (
        <div className="form-section">
          <h3>Register New User</h3>
          <Form
            initialValues={{
              email: '',
              password: '',
              confirmPassword: '',
              role: 'user'
            }}
            validationRules={registerValidationRules}
            onSubmit={handleRegisterSubmit}
            onCancel={() => setShowRegisterForm(false)}
            submitText="Register User"
            cancelText="Cancel"
            loading={loading}
            fields={[
              {
                name: 'email',
                label: 'Email Address',
                type: 'email',
                required: true,
                placeholder: 'Enter email address'
              },
              {
                name: 'password',
                label: 'Password',
                type: 'password',
                required: true,
                placeholder: 'Enter password',
                inputProps: {
                  minLength: 8
                }
              },
              {
                name: 'confirmPassword',
                label: 'Confirm Password',
                type: 'password',
                required: true,
                placeholder: 'Confirm password'
              },
              {
                name: 'role',
                label: 'Role',
                type: 'select',
                inputProps: {
                  children: (
                    <>
                      <option value="user">User</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </>
                  )
                }
              }
            ]}
          />
        </div>
      )}
      
      {showChangePasswordForm && (
        <div className="form-section">
          <h3>Change Password</h3>
          <Form
            initialValues={{
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: ''
            }}
            validationRules={passwordValidationRules}
            onSubmit={handleChangePasswordSubmit}
            onCancel={() => setShowChangePasswordForm(false)}
            submitText="Change Password"
            cancelText="Cancel"
            loading={loading}
            fields={[
              {
                name: 'currentPassword',
                label: 'Current Password',
                type: 'password',
                required: true,
                placeholder: 'Enter current password'
              },
              {
                name: 'newPassword',
                label: 'New Password',
                type: 'password',
                required: true,
                placeholder: 'Enter new password',
                inputProps: {
                  minLength: 8
                }
              },
              {
                name: 'confirmNewPassword',
                label: 'Confirm New Password',
                type: 'password',
                required: true,
                placeholder: 'Confirm new password'
              }
            ]}
          />
        </div>
      )}
      
      <div className="current-user-info">
        <h3>Current User</h3>
        <p><strong>Email:</strong> {currentUser?.email}</p>
        <p><strong>Role:</strong> {currentUser?.role || 'Unknown'}</p>
        <p><strong>Permissions:</strong> {currentUser?.permissions?.join(', ') || 'None'}</p>
      </div>
    </div>
  );
};

export default UserManagement;