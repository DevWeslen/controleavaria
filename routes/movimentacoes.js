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

    const itemPrincipal = await prisma.item.findUnique({ where: { id: itemId } });
    if (!itemPrincipal) return res.status(404).json({ error: 'Item não encontrado' });
    if (itemPrincipal.status === 'SAIU') return res.status(400).json({ error: 'Item já foi retirado do estoque' });

    // Se o usuário pedir saída de 6 mas esse ID só tem 1,
    // buscamos itens idênticos no mesmo local para completar a baixa.
    const itensIden = await prisma.item.findMany({
      where: {
        codigo: itemPrincipal.codigo,
        localizacaoId: itemPrincipal.localizacaoId,
        status: 'ESTOQUE'
      },
      orderBy: { createdAt: 'asc' }
    });

    let qtdRestante = quantidade ? parseInt(quantidade) : itemPrincipal.quantidade;
    const idsAfetados = [];

    // Prioriza o item principal clicado, depois os outros idênticos
    const itensParaBaixa = [
      itemPrincipal,
      ...itensIden.filter(i => i.id !== itemPrincipal.id)
    ];

    for (const item of itensParaBaixa) {
      if (qtdRestante <= 0) break;

      const baixaNesteItem = Math.min(qtdRestante, item.quantidade);
      const novoStatus = baixaNesteItem >= item.quantidade ? 'SAIU' : 'ESTOQUE';
      const novaQtd = Math.max(0, item.quantidade - baixaNesteItem);

      await prisma.item.update({
        where: { id: item.id },
        data: { status: novoStatus, quantidade: novaQtd }
      });

      await prisma.movimentacao.create({
        data: {
          id: uuidv4(),
          itemId: item.id,
          tipo: 'SAIDA',
          motivo,
          destino,
          quantidade: baixaNesteItem,
          usuario: usuario || 'Sistema',
          observacao
        }
      });

      idsAfetados.push(item.id);
      qtdRestante -= baixaNesteItem;
    }

    res.status(201).json({ success: true, afetados: idsAfetados });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar saída', details: error.message });
  }
});

module.exports = router;
