import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout, isAuthenticated } from '../services/authService';
import { getConnectionState, onConnectionStateChange } from '../services/firebaseService';

const NavigationBar = ({ currentPage }) => {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(getConnectionState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onConnectionStateChange(setIsOnline);
    return () => unsubscribe();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/login';
    }
  };

  const showLogoutButton = isAuthenticated();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="navigation-bar" role="navigation" aria-label="Main navigation" ref={menuRef}>
      <div className="nav-container">

        <div className="nav-brand">
          <Link to="/tables" onClick={closeMenu} style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo.png" alt="Nahari King Logo" className="navbar-logo" onError={(e) => { e.target.onerror = null; e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
            <span className="navbar-title" style={{ display: 'none' }}>Nahari King</span>
          </Link>
        </div>

        <div className={`hamburger-menu ${isMenuOpen ? 'open' : ''}`} onClick={toggleMenu} aria-label="Toggle Navigation Menu">
          <div className="hamburger-line"></div>
          <div className="hamburger-line"></div>
          <div className="hamburger-line"></div>
        </div>

        <div className={`nav-links-dropdown ${isMenuOpen ? 'open' : ''}`}>
          <Link to="/tables" className={`nav-link ${currentPage === 'tables' ? 'active' : ''}`} onClick={closeMenu}>Tables</Link>
          <Link to="/inventory" className={`nav-link ${currentPage === 'inventory' ? 'active' : ''}`} onClick={closeMenu}>Inventory</Link>
          <Link to="/recipes" className={`nav-link ${currentPage === 'recipes' ? 'active' : ''}`} onClick={closeMenu}>Recipes</Link>
          <Link to="/analytics" className={`nav-link ${currentPage === 'analytics' ? 'active' : ''}`} onClick={closeMenu}>Analytics</Link>
          <Link to="/shift" className={`nav-link ${currentPage === 'shift' ? 'active' : ''}`} onClick={closeMenu}>Shift</Link>
          <Link to="/settings" className={`nav-link ${currentPage === 'settings' ? 'active' : ''}`} onClick={closeMenu}>Settings</Link>

          {showLogoutButton && (
            <div className="nav-link logout-option" onClick={handleLogout} style={{ cursor: 'pointer' }}>
              <div
                className={`connection-status-dot ${isOnline ? 'online' : 'offline'}`}
                title={isOnline ? 'Online' : 'Offline'}
                style={{ position: 'relative', top: '0', display: 'inline-block' }}
              ></div>
              <span>Logout</span>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
};

export default NavigationBar;