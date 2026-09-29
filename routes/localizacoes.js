const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

// GET /api/localizacoes
router.get('/', async (req, res) => {
  try {
    const { setorId } = req.query;
    const where = setorId ? { setorId } : {};
    const localizacoes = await prisma.localizacao.findMany({
      where,
      include: {
        setor: true,
        itens: { where: { status: 'ESTOQUE' } }
      }
    });
    res.json(localizacoes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar localizações', details: error.message });
  }
});

// POST /api/localizacoes
router.post('/', async (req, res) => {
  try {
    const { codigo, descricao, tipo, setorId, posicaoX, posicaoY, posicaoZ, capacidade } = req.body;
    const loc = await prisma.localizacao.create({
      data: { id: uuidv4(), codigo, descricao, tipo, setorId, posicaoX, posicaoY, posicaoZ, capacidade },
      include: { setor: true }
    });
    res.status(201).json(loc);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar localização', details: error.message });
  }
});

// DELETE /api/localizacoes/:id
router.delete('/:id', async (req, res) => {
  try {
    // Check if there are items in this location
    const count = await prisma.item.count({ where: { localizacaoId: req.params.id, status: 'ESTOQUE' } });
    if (count > 0) {
      return res.status(400).json({ error: 'Não é possível deletar uma localização com itens em estoque' });
    }
    await prisma.localizacao.delete({ where: { id: req.params.id } });
    res.json({ message: 'Localização deletada' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar localização', details: error.message });
  }
});

module.exports = router;
