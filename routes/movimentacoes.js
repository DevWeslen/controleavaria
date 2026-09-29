const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

// GET /api/movimentacoes - Listar movimentações
router.get('/', async (req, res) => {
  try {
    const { itemId, tipo, limit = 50 } = req.query;

    const where = {};
    if (itemId) where.itemId = itemId;
    if (tipo) where.tipo = tipo;

    const movimentacoes = await prisma.movimentacao.findMany({
      where,
      include: { item: { include: { localizacao: { include: { setor: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit)
    });

    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar movimentações', details: error.message });
  }
});

// POST /api/movimentacoes - Registrar saída de item
router.post('/saida', async (req, res) => {
  try {
    const { itemId, motivo, destino, quantidade, usuario, observacao } = req.body;

    if (!itemId || !motivo) {
      return res.status(400).json({ error: 'itemId e motivo são obrigatórios' });
    }

    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    if (item.status === 'SAIU') return res.status(400).json({ error: 'Item já foi retirado do estoque' });

    // Atualizar status do item
    const qtdSaida = quantidade || item.quantidade;
    const novoStatus = qtdSaida >= item.quantidade ? 'SAIU' : 'ESTOQUE';
    const novaQtd = Math.max(0, item.quantidade - qtdSaida);

    await prisma.item.update({
      where: { id: itemId },
      data: { status: novoStatus, quantidade: novaQtd }
    });

    // Registrar movimentação
    const movimentacao = await prisma.movimentacao.create({
      data: {
        id: uuidv4(),
        itemId,
        tipo: 'SAIDA',
        motivo,
        destino,
        quantidade: qtdSaida,
        usuario: usuario || 'Sistema',
        observacao
      },
      include: { item: true }
    });

    res.status(201).json(movimentacao);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar saída', details: error.message });
  }
});

module.exports = router;
