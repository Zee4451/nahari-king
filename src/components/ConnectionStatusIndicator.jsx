import React, { useState, useEffect } from 'react';
import { getConnectionState, onConnectionStateChange } from '../services/firebaseService';

// This component is now deprecated since the connection status indicator
// has been moved to the NavigationBar component as a dot next to the logout button
const ConnectionStatusIndicator = ({ position = 'fixed', top = '70px', right = '10px', zIndex = 90 }) => {
  const [isOnline, setIsOnline] = useState(getConnectionState());

  useEffect(() => {
    const unsubscribe = onConnectionStateChange(setIsOnline);
    return () => unsubscribe();
  }, []);

  // For backward compatibility, render nothing since the indicator is now in the navbar
  return null;
};

export default ConnectionStatusIndicator;