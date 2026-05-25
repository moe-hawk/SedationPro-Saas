import app from '../apps/api/dist/server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  await app.ready();

  if (req.url?.startsWith('/api/')) {
    req.url = req.url.slice(4);
  }

  app.server.emit('request', req, res);
}
