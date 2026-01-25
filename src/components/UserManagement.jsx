import React, { useState, useEffect } from 'react';
import { 
  register, 
  changePassword, 
  getCurrentUser, 
  isAdmin,
  isAuthenticated
} from '../services/authService';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showChangePasswordForm, setShowChangePasswordForm] = useState(false);
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user is authenticated and admin
  useEffect(() => {
    if (!isAuthenticated() || !isAdmin()) {
      // This should be handled by route protection, but extra safety
      return;
    }
  }, []);

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const validateRegisterForm = () => {
    if (!registerData.email || !registerData.password || !registerData.confirmPassword) {
      setError('All fields are required');
      return false;
    }
    
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    
    if (registerData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }
    
    return true;
  };

  const validatePasswordForm = () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmNewPassword) {
      setError('All fields are required');
      return false;
    }
    
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setError('New passwords do not match');
      return false;
    }
    
    if (passwordData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      return false;
    }
    
    return true;
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validateRegisterForm()) return;
    
    setLoading(true);
    
    try {
      await register(registerData.email, registerData.password, registerData.role);
      setSuccess('User registered successfully!');
      setRegisterData({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'user'
      });
      setShowRegisterForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!validatePasswordForm()) return;
    
    setLoading(true);
    
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setSuccess('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      });
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
        <div className="error-banner">
          {error}
        </div>
      )}
      
      {success && (
        <div className="success-banner">
          {success}
        </div>
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
          <form onSubmit={handleRegisterSubmit} className="user-form">
            <div className="form-group">
              <label htmlFor="email">Email Address:</label>
              <input
                type="email"
                id="email"
                name="email"
                value={registerData.email}
                onChange={handleRegisterChange}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                name="password"
                value={registerData.password}
                onChange={handleRegisterChange}
                required
                disabled={loading}
                minLength="8"
              />
              <small>Password must contain at least 8 characters including uppercase, lowercase, number, and special character</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password:</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={registerData.confirmPassword}
                onChange={handleRegisterChange}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="role">Role:</label>
              <select
                id="role"
                name="role"
                value={registerData.role}
                onChange={handleRegisterChange}
                disabled={loading}
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-submit"
              disabled={loading}
            >
              {loading ? 'Registering...' : 'Register User'}
            </button>
          </form>
        </div>
      )}
      
      {showChangePasswordForm && (
        <div className="form-section">
          <h3>Change Password</h3>
          <form onSubmit={handleChangePasswordSubmit} className="user-form">
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password:</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password:</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                disabled={loading}
                minLength="8"
              />
              <small>Password must contain at least 8 characters including uppercase, lowercase, number, and special character</small>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmNewPassword">Confirm New Password:</label>
              <input
                type="password"
                id="confirmNewPassword"
                name="confirmNewPassword"
                value={passwordData.confirmNewPassword}
                onChange={handlePasswordChange}
                required
                disabled={loading}
              />
            </div>
            
            <button 
              type="submit" 
              className="btn btn-submit"
              disabled={loading}
            >
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
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