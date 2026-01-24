import { useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TablesPage from './components/TablesPage';
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
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<TablesPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
