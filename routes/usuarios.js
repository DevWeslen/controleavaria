const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authMiddleware, requireRole, hashPassword } = require('../lib/auth');

// Todas as rotas de usuários exigem ser ADMIN
router.use(authMiddleware);
router.use(requireRole('ADMIN'));

// GET /api/usuarios - Listar todos os usuários
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: {
        id: true,
        nome: true,
        login: true,
        role: true,
        ativo: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { nome: 'asc' }
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar usuários.', details: error.message });
  }
});

// POST /api/usuarios - Criar novo usuário
router.post('/', async (req, res) => {
  try {
    const { nome, login, role, ativo } = req.body;

    const senha = req.body.senha || 'Princesa123';

    if (!nome || !login) {
      return res.status(400).json({ error: 'Nome e login são obrigatórios.' });
    }

    const cleanLogin = login.trim().toLowerCase();
    const validRoles = ['ADMIN', 'GESTOR', 'OPERADOR'];
    const chosenRole = role && validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'OPERADOR';

    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    // Verificar se login já existe
    const existente = await prisma.usuario.findFirst({
      where: { login: { equals: cleanLogin, mode: 'insensitive' } }
    });

    if (existente) {
      return res.status(400).json({ error: 'Já existe um usuário com este login.' });
    }

    const hashedPassword = await hashPassword(senha);

    const novo = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        login: cleanLogin,
        senha: hashedPassword,
        mustChangePassword: true,
        role: chosenRole,
        ativo: ativo !== undefined ? Boolean(ativo) : true
      },
      select: {
        id: true,
        nome: true,
        login: true,
        role: true,
        ativo: true,
        createdAt: true
      }
    });

    res.status(201).json(novo);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar usuário.', details: error.message });
  }
});

// PUT /api/usuarios/:id - Editar usuário
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, login, role, ativo, novaSenha } = req.body;

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updateData = {};
    if (nome) updateData.nome = nome.trim();

    if (login) {
      const cleanLogin = login.trim().toLowerCase();
      if (cleanLogin !== usuario.login) {
        const existente = await prisma.usuario.findFirst({
          where: {
            login: { equals: cleanLogin, mode: 'insensitive' },
            id: { not: id }
          }
        });
        if (existente) {
          return res.status(400).json({ error: 'Já existe outro usuário com este login.' });
        }
        updateData.login = cleanLogin;
      }
    }

    if (role) {
      const validRoles = ['ADMIN', 'GESTOR', 'OPERADOR'];
      if (validRoles.includes(role.toUpperCase())) {
        // Se for o próprio admin tentando tirar seu próprio cargo de admin, validar se sobra outro
        if (usuario.role === 'ADMIN' && role.toUpperCase() !== 'ADMIN') {
          const totalAdmins = await prisma.usuario.count({
            where: { role: 'ADMIN', ativo: true }
          });
          if (totalAdmins <= 1) {
            return res.status(400).json({ error: 'Não é possível remover o único Administrador ativo.' });
          }
        }
        updateData.role = role.toUpperCase();
      }
    }

    if (ativo !== undefined) {
      const novoAtivo = Boolean(ativo);
      if (!novoAtivo && usuario.role === 'ADMIN') {
        const totalAdmins = await prisma.usuario.count({
          where: { role: 'ADMIN', ativo: true }
        });
        if (totalAdmins <= 1) {
          return res.status(400).json({ error: 'Não é possível desativar o único Administrador ativo.' });
        }
      }
      updateData.ativo = novoAtivo;
    }

    if (novaSenha) {
      if (novaSenha.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter no mínimo 6 caracteres.' });
      }
      updateData.senha = await hashPassword(novaSenha);
      updateData.mustChangePassword = true;
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        nome: true,
        login: true,
        role: true,
        ativo: true,
        updatedAt: true
      }
    });

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar usuário.', details: error.message });
  }
});

// DELETE /api/usuarios/:id - Deletar usuário
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ error: 'Você não pode excluir a sua própria conta logada.' });
    }

    const usuario = await prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (usuario.role === 'ADMIN') {
      const totalAdmins = await prisma.usuario.count({
        where: { role: 'ADMIN' }
      });
      if (totalAdmins <= 1) {
        return res.status(400).json({ error: 'Não é possível excluir o único Administrador cadastrado.' });
      }
    }

    await prisma.usuario.delete({ where: { id } });
    res.json({ message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir usuário.', details: error.message });
  }
});

module.exports = router;
