const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { hashPassword, comparePassword, generateToken, authMiddleware } = require('../lib/auth');

const DEFAULT_PASSWORD = 'Princesa123';

// Inicialização automática de usuários padrão se a tabela estiver vazia
async function bootstrapDefaultUsers() {
  try {
    const count = await prisma.usuario.count();
    if (count === 0) {
      console.log('🔄 Criando usuários padrão (ADMIN, GESTOR, OPERADOR)...');
      
      const defaultPass = await hashPassword(DEFAULT_PASSWORD);
      const adminPass = defaultPass;
      const gestorPass = defaultPass;
      const operadorPass = defaultPass;

      await prisma.usuario.createMany({
        data: [
          {
            nome: 'Administrador',
            login: 'admin',
            senha: adminPass,
            role: 'ADMIN',
            ativo: true,
            mustChangePassword: true
          },
          {
            nome: 'Gestor de Estoque',
            login: 'gestor',
            senha: gestorPass,
            role: 'GESTOR',
            ativo: true,
            mustChangePassword: true
          },
          {
            nome: 'Operador',
            login: 'operador',
            senha: operadorPass,
            role: 'OPERADOR',
            ativo: true,
            mustChangePassword: true
          }
        ]
      });

      console.log('✅ Usuários padrão criados (senha inicial: ' + DEFAULT_PASSWORD + ', troca obrigatória):');
      console.log('   - admin (ADMIN) / gestor (GESTOR) / operador (OPERADOR)');
    }
  } catch (err) {
    console.error('Erro no bootstrap de usuários:', err.message);
  }
}

// Executar verificação de bootstrap
bootstrapDefaultUsers();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const login = req.body.username || req.body.login;
    const senha = req.body.password || req.body.senha;

    if (!login || !senha) {
      return res.status(400).json({ error: 'Por favor, preencha usuário e senha.' });
    }

    const cleanLogin = String(login).trim().toLowerCase();

    // Buscar usuário pelo login (case-insensitive)
    const usuario = await prisma.usuario.findFirst({
      where: {
        login: { equals: cleanLogin, mode: 'insensitive' }
      }
    });

    if (!usuario) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    if (!usuario.ativo) {
      return res.status(403).json({ error: 'Este usuário está desativado. Contate o administrador.' });
    }

    // Validar senha
    const senhaValida = await comparePassword(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
    }

    // Gerar token
    const token = generateToken(usuario);

    const userObj = {
      id: usuario.id,
      nome: usuario.nome,
      username: usuario.login,
      login: usuario.login,
      role: usuario.role,
      mustChangePassword: usuario.mustChangePassword
    };

    res.json({
      token,
      user: userObj,
      usuario: userObj
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar login.', details: error.message });
  }
});

// GET /api/auth/me - Obter dados do usuário atual logado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        login: true,
        role: true,
        mustChangePassword: true,
        ativo: true,
        createdAt: true
      }
    });

    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ error: 'Usuário inválido ou inativo.' });
    }

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter dados do usuário.', details: error.message });
  }
});

// PUT /api/auth/senha - Alterar própria senha
router.put('/senha', authMiddleware, async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;

    if (!senhaAtual || !novaSenha) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha.' });
    }

    if (novaSenha.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: req.user.id }
    });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const valida = await comparePassword(senhaAtual, usuario.senha);
    if (!valida) {
      return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    if (novaSenha === DEFAULT_PASSWORD || novaSenha === senhaAtual) {
      return res.status(400).json({ error: 'A nova senha deve ser diferente da senha atual e da senha padrão.' });
    }

    const novaHash = await hashPassword(novaSenha);
    const atualizado = await prisma.usuario.update({
      where: { id: req.user.id },
      data: { senha: novaHash, mustChangePassword: false }
    });

    res.json({ message: 'Senha alterada com sucesso.', token: generateToken(atualizado) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao alterar senha.', details: error.message });
  }
});

module.exports = router;
