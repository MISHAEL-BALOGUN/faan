if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production.');
  if (!process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL must be set in production.');
}

import app from '../server/dist/src/app.js';

// Vercel routes /api/* to this catch-all function. Depending on the runtime it
// either hands us the full path or the path with the /api prefix stripped, so
// normalise before Express does its routing.
export default function handler(req, res) {
  if (!req.url.startsWith('/api')) req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  return app(req, res);
}
