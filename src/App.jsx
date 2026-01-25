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
            
            {/* Protected routes */}
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <TablesPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tables" 
              element={
                <ProtectedRoute>
                  <TablesPage />
                </ProtectedRoute>
              } 
            />
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
            <Route 
              path="/history" 
              element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingSpinner />}>
                    <HistoryPage />
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