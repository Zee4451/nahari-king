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
import styles from './UserManagement.module.css';

const UserManagement = () => {
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

  useEffect(() => {
    if (!isAuthenticated() || !isAdmin()) {
      return;
    }
  }, []);

  const handleRegisterSubmit = async (formData) => {
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      await register(formData.email, formData.password, formData.role);
      setSuccess(`User "${formData.email}" registered successfully!`);
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
      <div className={styles.umContainer}>
        <div className={styles.profileCard}>
          <h3 style={{ color: '#e53e3e', margin: 0 }}>Access Restricted</h3>
          <p style={{ color: '#718096', margin: 0 }}>You must be logged in as an administrator to access user management settings.</p>
        </div>
      </div>
    );
  }

  const role = currentUser?.role || 'user';
  const roleBadgeClass = role === 'admin' 
    ? styles.badgeAdmin 
    : role === 'manager' 
      ? styles.badgeManager 
      : styles.badgeUser;

  const userInitial = (currentUser?.email?.[0] || 'U').toUpperCase();

  return (
    <div className={styles.umContainer}>
      {/* Header */}
      <div className={styles.umHeader}>
        <div>
          <h2 className={styles.umTitle}>👥 User & Access Management</h2>
          <p className={styles.umSubtitle}>Manage restaurant staff roles, credentials, and access privileges.</p>
        </div>
      </div>
      
      {/* Alerts */}
      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} autoDismiss={3500} />}
      
      {/* Current User Profile Card */}
      <div className={styles.profileCard}>
        <div className={styles.cardHeader}>
          <div className={styles.avatar}>{userInitial}</div>
          <div className={styles.userInfo}>
            <h3 className={styles.userEmail}>{currentUser?.email || 'Logged In Administrator'}</h3>
            <span className={`${styles.roleBadge} ${roleBadgeClass}`}>
              🛡️ {role.toUpperCase()}
            </span>
          </div>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.detailRow}>
            <span className={styles.label}>Permissions:</span>
            <div className={styles.permissionChips}>
              {(currentUser?.permissions && currentUser.permissions.length > 0) ? (
                currentUser.permissions.map((perm, idx) => (
                  <span key={idx} className={styles.chip}>✓ {perm}</span>
                ))
              ) : (
                <span className={styles.chip}>Standard Permissions</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Cards Grid */}
      <div className={styles.actionsGrid}>
        {/* Register New User Action Card */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardTop}>
            <div className={styles.actionIcon}>➕</div>
            <div className={styles.actionText}>
              <h4>Register Staff Member</h4>
              <p>Create a new account with customized role permissions.</p>
            </div>
          </div>
          <button 
            className={`${styles.btnPrimary} ${showRegisterForm ? styles.btnActive : ''}`}
            onClick={() => {
              setShowRegisterForm(!showRegisterForm);
              if (!showRegisterForm) setShowChangePasswordForm(false);
            }}
          >
            {showRegisterForm ? '✕ Close Form' : '+ New User'}
          </button>
        </div>

        {/* Change Password Action Card */}
        <div className={styles.actionCard}>
          <div className={styles.actionCardTop}>
            <div className={styles.actionIcon} style={{ backgroundColor: '#fefcbf', color: '#b7791f' }}>🔑</div>
            <div className={styles.actionText}>
              <h4>Change Account Password</h4>
              <p>Update your current administrator password securely.</p>
            </div>
          </div>
          <button 
            className={`${styles.btnSecondary} ${showChangePasswordForm ? styles.btnActive : ''}`}
            onClick={() => {
              setShowChangePasswordForm(!showChangePasswordForm);
              if (!showChangePasswordForm) setShowRegisterForm(false);
            }}
          >
            {showChangePasswordForm ? '✕ Close Form' : 'Update Password'}
          </button>
        </div>
      </div>
      
      {/* Register User Form Panel */}
      {showRegisterForm && (
        <div className={styles.formPanel}>
          <div className={styles.formPanelHeader}>
            <h3>👤 Register New Staff / Manager</h3>
            <button className={styles.closeBtn} onClick={() => setShowRegisterForm(false)} title="Close">✕</button>
          </div>
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
            submitText="Create Account"
            cancelText="Cancel"
            loading={loading}
            fields={[
              {
                name: 'email',
                label: 'Email Address',
                type: 'email',
                required: true,
                placeholder: 'e.g. staff@nahariking.com'
              },
              {
                name: 'password',
                label: 'Account Password',
                type: 'password',
                required: true,
                placeholder: 'Minimum 8 characters',
                inputProps: {
                  minLength: 8
                }
              },
              {
                name: 'confirmPassword',
                label: 'Confirm Password',
                type: 'password',
                required: true,
                placeholder: 'Re-enter password'
              },
              {
                name: 'role',
                label: 'Access Role',
                type: 'select',
                inputProps: {
                  children: (
                    <>
                      <option value="user">Staff / Cashier (Order Entry)</option>
                      <option value="manager">Manager (Inventory + Menu)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </>
                  )
                }
              }
            ]}
          />
        </div>
      )}
      
      {/* Change Password Form Panel */}
      {showChangePasswordForm && (
        <div className={styles.formPanel}>
          <div className={styles.formPanelHeader}>
            <h3>🔑 Change Administrator Password</h3>
            <button className={styles.closeBtn} onClick={() => setShowChangePasswordForm(false)} title="Close">✕</button>
          </div>
          <Form
            initialValues={{
              currentPassword: '',
              newPassword: '',
              confirmNewPassword: ''
            }}
            validationRules={passwordValidationRules}
            onSubmit={handleChangePasswordSubmit}
            onCancel={() => setShowChangePasswordForm(false)}
            submitText="Update Password"
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
                placeholder: 'Enter new password (min 8 chars)',
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
    </div>
  );
};

export default UserManagement;