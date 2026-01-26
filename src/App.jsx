import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TablesPage from './components/TablesPage';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';
import './components/ProtectedRoute.css';

// Lazy load heavy components
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const HistoryPage = lazy(() => import('./components/HistoryPage'));

// Loading component for suspense
const LoadingSpinner = () => (
  <div className="page-content" style={{ textAlign: 'center', padding: '2rem' }}>
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

function App() {
  return (
    <Router>
      <div className="app">
        <ErrorBoundary>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Public routes - no authentication required */}
            <Route path="/" element={<TablesPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/history" element={
              <Suspense fallback={<LoadingSpinner />}>
                <HistoryPage />
              </Suspense>
            } />
            
            {/* Protected route - Settings page requires authentication */}
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute requiredPermission="settings_access">
                  <Suspense fallback={<LoadingSpinner />}>
                    <SettingsPage />
                  </Suspense>
                </ProtectedRoute>
              } 
            />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  );
}

export default App;