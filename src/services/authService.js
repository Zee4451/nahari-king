import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { db, auth } from '../firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Rate limiting constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const LOGIN_WINDOW = 5 * 60 * 1000; // 5 minutes

// Local storage keys
const AUTH_STORAGE_KEY = 'nalli_nihari_auth';
const FAILED_ATTEMPTS_KEY = 'failed_login_attempts';

// Rate limiting utility
class RateLimiter {
  constructor() {
    this.attempts = this.loadAttempts();
  }

  loadAttempts() {
    try {
      const stored = localStorage.getItem(FAILED_ATTEMPTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  saveAttempts() {
    try {
      localStorage.setItem(FAILED_ATTEMPTS_KEY, JSON.stringify(this.attempts));
    } catch (error) {
      console.error('Failed to save login attempts:', error);
    }
  }

  addAttempt() {
    const now = Date.now();
    // Remove old attempts outside the window
    this.attempts = this.attempts.filter(attempt => 
      now - attempt.timestamp < LOGIN_WINDOW
    );
    
    this.attempts.push({ timestamp: now });
    this.saveAttempts();
  }

  isLockedOut() {
    const now = Date.now();
    const recentAttempts = this.attempts.filter(attempt => 
      now - attempt.timestamp < LOCKOUT_DURATION
    );
    
    return recentAttempts.length >= MAX_LOGIN_ATTEMPTS;
  }

  getLockoutTimeRemaining() {
    if (!this.isLockedOut()) return 0;
    
    const now = Date.now();
    const oldestRecentAttempt = Math.min(
      ...this.attempts
        .filter(attempt => now - attempt.timestamp < LOCKOUT_DURATION)
        .map(attempt => attempt.timestamp)
    );
    
    return Math.max(0, LOCKOUT_DURATION - (now - oldestRecentAttempt));
  }

  clearAttempts() {
    this.attempts = [];
    this.saveAttempts();
  }
}

const rateLimiter = new RateLimiter();

// Input validation utilities
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validatePassword = (password) => {
  // Password must be at least 8 characters, contain uppercase, lowercase, number, and special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password) && password.length <= 128;
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  // Remove potentially dangerous characters
  return input.trim().replace(/[<>]/g, '');
};

// Authentication service
class AuthService {
  constructor() {
    this.currentUser = null;
    this.authListeners = [];
    this.setupAuthListener();
  }

  setupAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is signed in - fetch user data from Firestore first
        try {
          // Fetch user role and permissions from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            this.currentUser = {
              ...user,
              role: userData.role || 'user',
              permissions: userData.permissions || []
            };
          } else {
            // Create default user document for existing Firebase Auth users
            await setDoc(doc(db, 'users', user.uid), {
              email: user.email,
              role: 'admin', // Default admin for first user
              permissions: ['settings_access', 'menu_management', 'user_management'],
              createdAt: new Date().toISOString()
            });
            
            this.currentUser = {
              ...user,
              role: 'admin',
              permissions: ['settings_access', 'menu_management', 'user_management']
            };
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          // Fallback to basic user without permissions
          this.currentUser = user;
        }
      } else {
        // User is signed out
        this.currentUser = null;
      }
      
      // Notify all listeners after user data is fully loaded
      this.authListeners.forEach(callback => callback(this.currentUser));
    });
  }

  // Add auth state listener
  onAuthStateChanged(callback) {
    this.authListeners.push(callback);
    // Immediately call with current state
    callback(this.currentUser);
    return () => {
      this.authListeners = this.authListeners.filter(cb => cb !== callback);
    };
  }

  // Check if user has required permission
  hasPermission(permission) {
    if (!this.currentUser) return false;
    return this.currentUser.permissions?.includes(permission) || false;
  }

  // Check if user is admin
  isAdmin() {
    return this.currentUser?.role === 'admin';
  }

  // Login with rate limiting
  async login(email, password) {
    try {
      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedPassword = sanitizeInput(password);
      
      // Validate inputs
      if (!validateEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }
      
      if (!sanitizedPassword) {
        throw new Error('Password is required');
      }
      
      // Check rate limiting
      if (rateLimiter.isLockedOut()) {
        const timeRemaining = rateLimiter.getLockoutTimeRemaining();
        const minutes = Math.ceil(timeRemaining / 60000);
        throw new Error(`Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.`);
      }
      
      // Attempt login
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        sanitizedEmail, 
        sanitizedPassword
      );
      
      // Clear failed attempts on successful login
      rateLimiter.clearAttempts();
      
      // Store auth state in localStorage for persistence
      this.storeAuthState(userCredential.user);
      
      return {
        success: true,
        user: userCredential.user
      };
    } catch (error) {
      // Record failed attempt
      rateLimiter.addAttempt();
      
      let errorMessage = 'Login failed';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Account temporarily locked.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'auth/configuration-not-found':
          errorMessage = 'Authentication service not configured. Please enable Firebase Authentication in Firebase Console.';
          break;
        default:
          errorMessage = error.message || 'Login failed. Please try again.';
      }
      
      throw new Error(errorMessage);
    }
  }

  // Logout
  async logout() {
    try {
      await signOut(auth);
      this.clearAuthState();
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      throw new Error('Logout failed');
    }
  }

  // Register new user (admin only)
  async register(email, password, role = 'user') {
    try {
      // Check if this is the first user (no users exist)
      let isFirstUser = false;
      try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        isFirstUser = usersSnapshot.empty;
      } catch (error) {
        console.warn('Could not check if first user, assuming not first:', error);
        isFirstUser = false;
      }

      // Verify admin permissions (unless this is the first user)
      if (!isFirstUser && !this.isAdmin()) {
        throw new Error('Insufficient permissions to create users');
      }
      
      // Sanitize inputs
      const sanitizedEmail = sanitizeInput(email);
      const sanitizedPassword = sanitizeInput(password);
      
      // Validate inputs
      if (!validateEmail(sanitizedEmail)) {
        throw new Error('Invalid email format');
      }
      
      if (!validatePassword(sanitizedPassword)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
      }
      
      // Check if user already exists
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', sanitizedEmail)
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        throw new Error('User with this email already exists');
      }
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        sanitizedEmail,
        sanitizedPassword
      );
      
      // Determine role - first user gets admin, others get specified role
      const userRole = isFirstUser ? 'admin' : role;
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: sanitizedEmail,
        role: userRole,
        permissions: this.getDefaultPermissions(userRole),
        createdBy: this.currentUser?.uid || userCredential.user.uid, // Self-created if first user
        createdAt: new Date().toISOString()
      });
      
      // If the newly created user is an admin, make sure current user still has proper permissions
      // This is important to ensure the current user doesn't lose admin privileges
      if (this.currentUser && this.currentUser.uid) {
        try {
          // Refresh current user's permissions to ensure they haven't changed
          const currentUserDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
          if (currentUserDoc.exists()) {
            const userData = currentUserDoc.data();
            this.currentUser = {
              ...this.currentUser,
              role: userData.role || this.currentUser.role,
              permissions: userData.permissions || this.currentUser.permissions
            };
          }
        } catch (refreshError) {
          console.warn('Could not refresh current user permissions:', refreshError);
        }
      }
      
      return {
        success: true,
        user: userCredential.user,
        isFirstUser: isFirstUser,
        assignedRole: userRole
      };
    } catch (error) {
      let errorMessage = 'Registration failed';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'Email already registered';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak';
          break;
        case 'auth/configuration-not-found':
          errorMessage = 'Authentication service not configured. Please enable Firebase Authentication in Firebase Console.';
          break;
        default:
          errorMessage = error.message || 'Registration failed';
      }
      
      throw new Error(errorMessage);
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    try {
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Validate new password
      if (!validatePassword(newPassword)) {
        throw new Error('New password must be at least 8 characters with uppercase, lowercase, number, and special character');
      }
      
      // Re-authenticate user
      const credential = EmailAuthProvider.credential(
        this.currentUser.email,
        currentPassword
      );
      
      await reauthenticateWithCredential(this.currentUser, credential);
      
      // Update password
      await updatePassword(this.currentUser, newPassword);
      
      return { success: true };
    } catch (error) {
      let errorMessage = 'Password change failed';
      
      switch (error.code) {
        case 'auth/wrong-password':
          errorMessage = 'Current password is incorrect';
          break;
        case 'auth/weak-password':
          errorMessage = 'New password is too weak';
          break;
        default:
          errorMessage = error.message || 'Password change failed';
      }
      
      throw new Error(errorMessage);
    }
  }

  // Get default permissions based on role
  getDefaultPermissions(role) {
    const permissions = {
      admin: ['settings_access', 'menu_management', 'user_management', 'order_history', 'reports'],
      manager: ['settings_access', 'menu_management', 'order_history'],
      user: ['order_history']
    };
    
    return permissions[role] || permissions.user;
  }

  // Store auth state in localStorage
  storeAuthState(user) {
    try {
      const authData = {
        uid: user.uid,
        email: user.email,
        timestamp: Date.now()
      };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
    } catch (error) {
      console.error('Failed to store auth state:', error);
    }
  }

  // Clear auth state from localStorage
  clearAuthState() {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear auth state:', error);
    }
  }

  // Check if user is authenticated
  isAuthenticated() {
    return !!this.currentUser;
  }

  // Get current user
  getCurrentUser() {
    return this.currentUser;
  }

  // Check if Settings page access is allowed
  canAccessSettings() {
    return this.hasPermission('settings_access');
  }
}

// Export singleton instance
const authService = new AuthService();
export default authService;

// Export individual functions with proper context binding
export const login = authService.login.bind(authService);
export const logout = authService.logout.bind(authService);
export const register = authService.register.bind(authService);
export const changePassword = authService.changePassword.bind(authService);
export const hasPermission = authService.hasPermission.bind(authService);
export const isAdmin = authService.isAdmin.bind(authService);
export const isAuthenticated = authService.isAuthenticated.bind(authService);
export const getCurrentUser = authService.getCurrentUser.bind(authService);
export const canAccessSettings = authService.canAccessSettings.bind(authService);

// Export the onAuthStateChanged method separately to avoid naming conflict
export const listenToAuthState = authService.onAuthStateChanged.bind(authService);
