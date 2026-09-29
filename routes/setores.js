const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

// GET /api/setores
router.get('/', async (req, res) => {
  try {
    const setores = await prisma.setor.findMany({
      include: {
        localizacoes: {
          include: {
            itens: {
              where: { status: 'ESTOQUE' },
              select: { id: true, nome: true, codigo: true, quantidade: true, status: true }
            }
          }
        }
      }
    });
    res.json(setores);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar setores', details: error.message });
  }
});

// POST /api/setores
router.post('/', async (req, res) => {
  try {
    const { nome, descricao, cor, posicaoX, posicaoY, largura, altura } = req.body;
    const setor = await prisma.setor.create({
      data: { id: uuidv4(), nome: nome.toUpperCase(), descricao, cor, posicaoX, posicaoY, largura, altura }
    });
    res.status(201).json(setor);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar setor', details: error.message });
  }
});

module.exports = router;
