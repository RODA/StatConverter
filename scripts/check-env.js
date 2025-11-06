#!/usr/bin/env node

// Fail the build if NODE_ENV is not explicitly set to production
if (process.env.NODE_ENV !== 'production') {
  console.error('Error: NODE_ENV must be set to "production" before building.');
  process.exit(1);
}

