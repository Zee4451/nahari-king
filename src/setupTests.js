// Setup file for React Testing Library
import '@testing-library/jest-dom';

// Mock Firebase for tests
jest.mock('../firebase', () => ({
  db: {},
  auth: {}
}));

// Mock performance monitoring
jest.mock('../utils/performanceMonitor', () => ({
  monitorFirebaseOperation: jest.fn((name, operation) => operation()),
  useRenderPerformance: jest.fn(() => {}),
  useFunctionPerformance: jest.fn((name, fn) => fn)
}));

// Mock react-dnd
jest.mock('react-dnd', () => ({
  DndProvider: ({ children }) => <div>{children}</div>,
  useDrag: () => [{}, jest.fn()],
  useDrop: () => [{}, jest.fn()]
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {}
}));

// Global test utilities
global.waitForComponentToPaint = async (wrapper) => {
  await new Promise(resolve => setTimeout(resolve, 0));
  wrapper.update();
};