import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated, listenToAuthState, canAccessSettings, hasPermission } from '../services/authService';
import LoginPage from './LoginPage';

const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = listenToAuthState((user) => {
      const authenticated = isAuthenticated();
      
      if (!authenticated && requiredPermission) {
        // Not authenticated but permission is required - redirect to login
        navigate('/login', { 
          state: { from: location },
          replace: true 
        });
        setIsAuthorized(false);
      } else if (authenticated && requiredPermission) {
        // Authenticated and permission is required - check permissions
        let authorized = true;
        
        if (requiredPermission) {
          if (requiredPermission === 'settings_access') {
            authorized = canAccessSettings();
          } else {
            // For other permissions, check them individually
            authorized = hasPermission(requiredPermission);
          }
        }
        
        if (!authorized) {
          // Authenticated but no permission - redirect to tables
          navigate('/tables', { replace: true });
        }
        
        setIsAuthorized(authorized);
      } else if (!requiredPermission) {
        // No permission required, allow access
        setIsAuthorized(true);
      } else {
        // Authenticated but no specific permission required
        setIsAuthorized(true);
      }
      
      setAuthChecked(true);
    });

    return unsubscribe;
  }, [navigate, location, requiredPermission]);

  // Show loading while checking auth state
  if (!authChecked) {
    return (
      <div className="auth-checking">
        <div className="loading-spinner"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  // Show login if not authenticated and permission is required
  if (requiredPermission && !isAuthenticated()) {
    return <LoginPage />;
  }

  // Show access denied if authenticated but no permission
  if (requiredPermission && !isAuthorized) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
        <button onClick={() => navigate('/tables')}>
          Return to Tables
        </button>
      </div>
    );
  }

  // Render children if authorized
  return children;
};

export default ProtectedRoute;