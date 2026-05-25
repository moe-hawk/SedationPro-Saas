import app from '../apps/api/dist/server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function stripLeadingSlashes(value) {
  let output = String(value || '');
  while (output.startsWith('/')) {
    output = output.slice(1);
  }
  return output;
}

function pathFromRequest(req) {
  const url = new URL(req.url || '/', 'http://vercel.local');
  const fromQuery = url.searchParams.get('path') || first(req.query?.path);

  if (typeof fromQuery === 'string' && fromQuery.length > 0) {
    url.searchParams.delete('path');
    const qs = url.searchParams.toString();
    return '/' + stripLeadingSlashes(fromQuery) + (qs ? '?' + qs : '');
  }

  if (req.url?.startsWith('/api/')) {
    return req.url.slice(4);
  }

  if (req.url === '/api') {
    return '/';
  }

  return req.url || '/';
}

export default async function handler(req, res) {
  await app.ready();
  req.url = pathFromRequest(req);
  app.server.emit('request', req, res);
}
