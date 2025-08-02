// Jest setup file for AlphaBase tests
// Handle global cleanup and timeout issues

// Extend timeout for all tests
jest.setTimeout(10000);

// Global cleanup after all tests
afterAll(async () => {
  // Wait for any pending promises
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Force cleanup any remaining handles
  if (global.gc) {
    global.gc();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.warn('Unhandled Promise Rejection:', reason);
});

// Suppress console logs during tests (optional)
if (process.env.NODE_ENV === 'test') {
  // Allow performance logs to be shown with SHOW_PERFORMANCE_LOGS=true
  const showPerformanceLogs = process.env.SHOW_PERFORMANCE_LOGS === 'true';
  
  global.console = {
    ...console,
    // Suppress logs during tests for cleaner output, unless performance logs are requested
    log: showPerformanceLogs ? console.log : () => {},
    // Keep warnings and errors visible
    // warn: () => {},
    // error: () => {},
  };
}
