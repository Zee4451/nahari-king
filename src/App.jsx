import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TablesPage from './components/TablesPage';
import ErrorBoundary from './components/ErrorBoundary';
import './App.css';

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
            <Route path="/" element={<TablesPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route 
              path="/settings" 
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <SettingsPage />
                </Suspense>
              } 
            />
            <Route 
              path="/history" 
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <HistoryPage />
                </Suspense>
              } 
            />
          </Routes>
        </ErrorBoundary>
      </div>
    </Router>
  );
}

export default App;
