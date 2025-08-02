// Set test environment variables before tests run
process.env.NODE_ENV = 'test';
process.env.ALPHABASE_DISABLE_CONNECTION_POOL = 'true';

// Disable connection pool completely in tests
global.ALPHABASE_TEST_MODE = true;
