// TypeScript type definitions for Firebase service layer
// Provides type safety for restaurant management system data structures

import * as React from 'react';

export interface Table {
  id: number;
  orders: Order[];
  total: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Order {
  id: number;
  items: MenuItem[];
  total: number;
  timestamp?: Date;
}

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  available: boolean;
  category: string;
  sequence?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface HistoryEntry {
  id: string;
  tableId: number;
  orders: Order[];
  total: number;
  timestamp: string | Date;
}


// User Management Types
export interface User {
  id: string;
  email: string;
  role: 'user' | 'manager' | 'admin';
  permissions: string[];
  createdAt: Date;
  lastLogin?: Date;
}

// Authentication Types
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Performance Monitoring Types
export interface PerformanceMetric {
  operation: string;
  count: number;
  average: number;
  max: number;
  min: number;
  totalDuration: number;
}

export interface PerformanceReport {
  timestamp: string;
  operations: Record<string, PerformanceMetric>;
  warnings: string[];
  recommendations: string[];
  optimizationOpportunities: Array<{
    operation: string;
    issue: string;
    suggestion: string;
  }>;
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
}

// Firebase Operation Types
export interface FirebaseOperationOptions {
  useCache?: boolean;
  cacheKey?: string;
  skipPerformanceMonitoring?: boolean;
  retryAttempts?: number;
  retryDelay?: number;
}


// Utility Types
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
export type RequiredFields<T, K extends keyof T> = Pick<Required<T>, K> & Omit<T, K>;

// Function type definitions
export type AsyncFunction<T = void> = (...args: any[]) => Promise<T>;
export type ValidationRule = {
  required?: boolean;
  requiredMessage?: string;
  minLength?: number;
  minLengthMessage?: string;
  maxLength?: number;
  maxLengthMessage?: string;
  pattern?: RegExp;
  patternMessage?: string;
  custom?: (value: any, formValues?: Record<string, any>) => string | void;
};

export type FormFieldConfig = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'password' | 'select' | 'checkbox' | 'textarea';
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  inputProps?: Record<string, any>;
};

// Hook return types
export interface UseFormReturn {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  setFieldValue: (name: string, value: any) => void;
  setValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export interface UseApiOperationReturn<T> {
  loading: boolean;
  error: string;
  success: string;
  execute: (...args: any[]) => Promise<T>;
  resetStates: () => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setSuccess: React.Dispatch<React.SetStateAction<string>>;
}

// Component prop types
export interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export interface ErrorBannerProps {
  message: string;
  onClose?: () => void;
  dismissible?: boolean;
  className?: string;
}

export interface SuccessBannerProps {
  message: string;
  onClose?: () => void;
  dismissible?: boolean;
  autoDismiss?: number;
  className?: string;
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}
