// check-env.ts
if (process.env.NODE_ENV !== 'production') {
    console.error('Error: NODE_ENV must be set to "production" before building.');
    process.exit(1);
}
