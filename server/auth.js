const crypto = require('crypto');

const PLAYER_CODE = process.env.PLAYER_PASSCODE || '';
const GM_CODE     = process.env.GM_PASSCODE || '';
const COOKIE_NAME = 'eote_role';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  maxAge:   1000 * 60 * 60 * 24 * 30,
  signed:   true,
};

function getCookieSecret() {
  const explicit = process.env.COOKIE_SECRET;
  if (explicit) return explicit;
  if (GM_CODE && PLAYER_CODE) return GM_CODE + ':' + PLAYER_CODE;
  return crypto.randomBytes(32).toString('hex');
}

const COOKIE_SECRET = getCookieSecret();

function loginRoute(req, res) {
  const { passcode } = req.body;
  if (!passcode) return res.status(400).json({ error: 'Passcode required.' });

  if (GM_CODE && passcode === GM_CODE) {
    res.cookie(COOKIE_NAME, 'gm', COOKIE_OPTS);
    return res.json({ role: 'gm' });
  }
  if (PLAYER_CODE && passcode === PLAYER_CODE) {
    res.cookie(COOKIE_NAME, 'player', COOKIE_OPTS);
    return res.json({ role: 'player' });
  }

  return res.status(401).json({ error: 'Invalid passcode.' });
}

function logoutRoute(_req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
}

function roleFromCookie(req) {
  return req.signedCookies && req.signedCookies[COOKIE_NAME];
}

function gate(req, res, next) {
  if (!GM_CODE && !PLAYER_CODE) return next();

  const publicPaths = ['/login', '/login/', '/api/auth/login', '/api/auth/logout'];
  if (publicPaths.includes(req.path)) return next();

  if (req.path.startsWith('/css/')    ||
      req.path.startsWith('/assets/')  ||
      req.path.startsWith('/js/')      ||
      req.path.startsWith('/data/')    ||
      req.path.startsWith('/images/')  ||
      req.path.startsWith('/audio/')   ||
      req.path === '/icon.svg'         ||
      req.path === '/favicon.ico') {
    return next();
  }

  const role = roleFromCookie(req);
  if (!role) {
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorized' });
    return res.redirect('/login');
  }

  if (role === 'player') {
    if (req.path === '/gm' || req.path === '/gm/' || req.path.startsWith('/gm/')) {
      return res.redirect('/');
    }
    if (req.path.startsWith('/api/campaign') || req.path === '/api/admin/release-all') {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  req.userRole = role;
  next();
}

module.exports = { loginRoute, logoutRoute, gate, roleFromCookie, COOKIE_SECRET };
