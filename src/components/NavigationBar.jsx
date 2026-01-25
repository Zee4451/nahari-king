import React from 'react';
import { Link } from 'react-router-dom';
import { logout } from '../services/authService';

const NavigationBar = ({ currentPage }) => {
  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to login page after logout
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <nav className="navigation-bar">
      <div className="nav-container">
        <Link 
          to="/tables" 
          className={`nav-link ${currentPage === 'tables' ? 'active' : ''}`}
        >
          Tables
        </Link>
        <Link 
          to="/settings" 
          className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`}
        >
          Settings
        </Link>
        <button 
          className="logout-button"
          onClick={handleLogout}
          type="button"
        >
          Logout
        </button>
      </div>
    </nav>
  );
};

export default NavigationBar;