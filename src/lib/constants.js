// src/lib/constants.js

// This constant will correctly pick up the public environment variable.
// Make sure you have a .env file (e.g., .env.development or .env) in your
// project root with:
// VITE_PUBLIC_Maps_API_KEY="YOUR_ACTUAL_Maps_API_KEY_HERE"
export const Maps_API_KEY = import.meta.env.VITE_PUBLIC_Maps_API_KEY || '';