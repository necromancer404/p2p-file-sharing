// Vite env (set in Vercel Project → Settings → Environment Variables)
// VITE_SIGNALING_SERVER — WebSocket signaling host (e.g. https://your-api.railway.app or http://EC2:3000)
// VITE_UPLOADCARE_PUBLIC_KEY — Uploadcare public key (dashboard → API keys)

export const APP_CONFIG = {
  SIGNALING_SERVER: import.meta.env.VITE_SIGNALING_SERVER || 'http://localhost:3000',
  UPLOADCARE_PUBLIC_KEY: import.meta.env.VITE_UPLOADCARE_PUBLIC_KEY || '22ae90c600fbfb5eb2db',
};
