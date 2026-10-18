// Relative by default: in dev the Vite proxy forwards /api to the backend, and in
// production the app is expected to be served behind the same host as the API.
// Set VITE_API_BASE_URL only when the API lives on a different origin.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
