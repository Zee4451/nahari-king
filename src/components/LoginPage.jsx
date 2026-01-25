import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { login, isAuthenticated, listenToAuthState, register } from '../services/authService';
import './LoginPage.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is already authenticated
  useEffect(() => {
    const unsubscribe = listenToAuthState((user) => {
      if (user && isAuthenticated()) {
        // Redirect to intended page or default to tables
        const from = location.state?.from?.pathname || '/tables';
        navigate(from, { replace: true });
      }
    });

    return unsubscribe;
  }, [navigate, location.state?.from?.pathname]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await login(email, password);
      // Navigation will be handled by the auth state listener
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    
    setLoading(true);

    try {
      const result = await register(email, password, 'admin');
      if (result.isFirstUser) {
        setSuccess('First admin account created successfully! You now have full system access.');
      } else {
        setSuccess('Account created successfully! You can now sign in.');
      }
      setRegistrationComplete(true);
      setShowRegister(false);
      // Clear form fields
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
    if (error) setError('');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Prevent paste on password field for security
  const handlePasswordPaste = (e) => {
    e.preventDefault();
  };

  const toggleRegisterView = () => {
    setShowRegister(!showRegister);
    setError('');
    setSuccess('');
    setRegistrationComplete(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Nalli Nihari POS</h1>
          <p>Restaurant Management System</p>
        </div>
        
        {!showRegister ? (
          // Login Form
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleEmailChange}
                required
                autoComplete="email"
                disabled={loading}
                className={error && !email ? 'error' : ''}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  onPaste={handlePasswordPaste}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  className={error && !password ? 'error' : ''}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {success && (
              <div className="success-message">
                {success}
              </div>
            )}
            
            <button 
              type="submit" 
              className="login-button"
              disabled={loading || !email || !password}
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Sign In'
              )}
            </button>
            
            <div className="login-footer">
              <button 
                type="button" 
                className="register-toggle"
                onClick={toggleRegisterView}
              >
                Create New Account
              </button>
              <p>Secure authentication required for system access</p>
            </div>
          </form>
        ) : (
          // Registration Form
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="reg-email">Email Address</label>
              <input
                type="email"
                id="reg-email"
                value={email}
                onChange={handleEmailChange}
                required
                autoComplete="email"
                disabled={loading}
                className={error && !email ? 'error' : ''}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="reg-password"
                  value={password}
                  onChange={handlePasswordChange}
                  onPaste={handlePasswordPaste}
                  required
                  autoComplete="new-password"
                  disabled={loading}
                  className={error && !password ? 'error' : ''}
                  minLength="8"
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={togglePasswordVisibility}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <small className="password-hint">
                Password must be at least 8 characters with uppercase, lowercase, number, and special character
              </small>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                required
                disabled={loading}
                className={error && !confirmPassword ? 'error' : ''}
              />
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            {success && (
              <div className="success-message">
                {success}
              </div>
            )}
            
            <button 
              type="submit" 
              className="login-button"
              disabled={loading || !email || !password || !confirmPassword}
            >
              {loading ? (
                <span className="loading-spinner"></span>
              ) : (
                'Create Account'
              )}
            </button>
            
            <div className="login-footer">
              <button 
                type="button" 
                className="register-toggle"
                onClick={toggleRegisterView}
              >
                Back to Sign In
              </button>
              <p><strong>First user:</strong> Automatically granted admin privileges<br/>
                 <strong>Additional users:</strong> Require admin invitation</p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;