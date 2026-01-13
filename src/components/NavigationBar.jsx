import React from 'react';
import { Link } from 'react-router-dom';

const NavigationBar = ({ currentPage }) => {
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
      </div>
    </nav>
  );
};

export default NavigationBar;