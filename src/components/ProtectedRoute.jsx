import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isAuthenticated, listenToAuthState, canAccessSettings } from '../services/authService';
import LoginPage from './LoginPage';

const ProtectedRoute = ({ children, requiredPermission = null }) => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = listenToAuthState((user) => {
      const authenticated = isAuthenticated();
      
      if (!authenticated) {
        // Not authenticated - redirect to login
        navigate('/login', { 
          state: { from: location },
          replace: true 
        });
        setIsAuthorized(false);
      } else {
        // Authenticated - check permissions if required
        let authorized = true;
        
        if (requiredPermission) {
          authorized = canAccessSettings(); // For now, Settings requires settings_access permission
        }
        
        if (!authorized) {
          // Authenticated but no permission - redirect to tables
          navigate('/tables', { replace: true });
        }
        
        setIsAuthorized(authorized);
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

  // Show login if not authenticated
  if (!isAuthenticated()) {
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