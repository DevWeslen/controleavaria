const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'princesa_avarias_jwt_secret_2026_super_seguro';

// Criptografia de senha
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

async function comparePassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

// Geração de token JWT
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      nome: user.nome,
      login: user.login,
      role: user.role,
      mcp: !!user.mustChangePassword
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Verificação de token JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Middleware de autenticação obrigatória
function authMiddleware(req, res, next) {
  let token = null;

  // Header Authorization: Bearer <token>
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.query && req.query.token) {
    // Permite token na query string para SSE / EventSource e downloads diretos
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Não autenticado. Faça login para continuar.' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  // Troca de senha obrigatória: só libera /auth/me e /auth/senha
  if (decoded.mcp) {
    const url = (req.originalUrl || '').split('?')[0];
    if (!/^\/api\/auth\/(me|senha)\/?$/.test(url)) {
      return res.status(403).json({
        error: 'Troca de senha obrigatória antes de continuar.',
        code: 'PASSWORD_CHANGE_REQUIRED'
      });
    }
  }

  req.user = decoded;
  next();
}

// Middleware de autenticação opcional (se logado, anexa req.user)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const decoded = verifyToken(token);
    if (decoded) req.user = decoded;
  }
  next();
}

// Middleware de autorização por papel (Role-Based Access Control)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Acesso negado. Apenas perfis [${roles.join(', ')}] têm permissão para esta ação.`
      });
    }

    next();
  };
}

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuth,
  requireRole
};
