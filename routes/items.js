const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

// Gerar código único para item
function gerarCodigo() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AV-${timestamp}-${random}`;
}

// GET /api/items - Listar todos os itens
router.get('/', async (req, res) => {
  try {
    const { status, setorId, search } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (setorId) {
      where.localizacao = { setorId };
    }

    const items = await prisma.item.findMany({
      where,
      include: {
        localizacao: {
          include: { setor: true }
        },
        lote: { select: { id: true, codigo: true, nome: true, status: true } },
        movimentacoes: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar itens', details: error.message });
  }
});

// GET /api/items/scrape/search
router.get('/scrape/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Termo de busca obrigatório' });
    const { scrapePrices } = require('../lib/scraper');
    const result = await scrapePrices(q);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro no scraping', details: error.message });
  }
});

// GET /api/items/stats/dashboard - Estatísticas para dashboard
router.get('/stats/dashboard', async (req, res) => {
  try {
    const [total, emEstoque, saidos, porSetor] = await Promise.all([
      prisma.item.count(),
      prisma.item.count({ where: { status: 'ESTOQUE' } }),
      prisma.item.count({ where: { status: 'SAIU' } }),
      prisma.setor.findMany({
        include: {
          localizacoes: {
            include: {
              _count: { select: { itens: true } }
            }
          }
        }
      })
    ]);

    const ultimasMovimentacoes = await prisma.movimentacao.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { item: true }
    });

    const saidasAgrupadas = await prisma.movimentacao.groupBy({
      by: ['motivo'],
      where: { tipo: 'SAIDA' },
      _sum: { quantidade: true }
    });

    res.json({
      total,
      emEstoque,
      saidos,
      porSetor,
      ultimasMovimentacoes,
      saidasAgrupadas
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas', details: error.message });
  }
});

// GET /api/items/:id - Buscar item por ID
router.get('/:id', async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: {
        localizacao: { include: { setor: true } },
        lote: { select: { id: true, codigo: true, nome: true, status: true } },
        movimentacoes: { orderBy: { createdAt: 'desc' } }
      }
    });
    
    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar item', details: error.message });
  }
});

// POST /api/items - Cadastrar novo item
router.post('/', async (req, res) => {
  try {
    const { nome, descricao, quantidade, motivoAvaria, localizacaoId, usuario, valorNf, valorInternet, sugestao, unidadeMedida, itensPorCaixa } = req.body;
    
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const codigo = gerarCodigo();
    
    const item = await prisma.item.create({
      data: {
        id: uuidv4(),
        codigo,
        nome,
        descricao,
        quantidade: quantidade || 1,
        unidadeMedida: unidadeMedida || 'UN',
        itensPorCaixa: itensPorCaixa ? parseInt(itensPorCaixa) : null,
        motivoAvaria,
        localizacaoId: localizacaoId || null,
        status: 'ESTOQUE',
        valorNf: valorNf ? parseFloat(valorNf) : null,
        valorInternet: valorInternet ? parseFloat(valorInternet) : null,
        sugestao: sugestao ? parseFloat(sugestao) : null
      },
      include: {
        localizacao: { include: { setor: true } }
      }
    });

    // Registrar movimentação de entrada
    await prisma.movimentacao.create({
      data: {
        id: uuidv4(),
        itemId: item.id,
        tipo: 'ENTRADA',
        motivo: 'CADASTRO',
        quantidade: item.quantidade,
        usuario: usuario || 'Sistema',
        observacao: 'Item cadastrado no sistema'
      }
    });

    // Emitir evento SSE para todos os clientes conectados
    const emitSSE = req.app.locals.emitSSE;
    if (emitSSE) {
      emitSSE('novo_item', {
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        quantidade: item.quantidade,
        setor: item.localizacao?.setor?.nome || null,
        setorCor: item.localizacao?.setor?.cor || null,
        localizacao: item.localizacao?.codigo || null,
        createdAt: item.createdAt
      });
    }

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar item', details: error.message });
  }
});

// PUT /api/items/:id - Atualizar item
router.put('/:id', async (req, res) => {
  try {
    const { nome, descricao, quantidade, motivoAvaria, localizacaoId, status, valorNf, valorInternet, sugestao, unidadeMedida, itensPorCaixa } = req.body;

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: {
        nome,
        descricao,
        quantidade,
        unidadeMedida,
        itensPorCaixa: itensPorCaixa ? parseInt(itensPorCaixa) : null,
        motivoAvaria,
        localizacaoId: localizacaoId || null,
        status,
        valorNf: valorNf !== undefined ? parseFloat(valorNf) : undefined,
        valorInternet: valorInternet !== undefined ? parseFloat(valorInternet) : undefined,
        sugestao: sugestao !== undefined ? parseFloat(sugestao) : undefined
      },
      include: {
        localizacao: { include: { setor: true } }
      }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar item', details: error.message });
  }
});

// POST /api/items/:id/transferir — Transferir item para outro setor/localizacao
router.post('/:id/transferir', async (req, res) => {
  try {
    const { localizacaoId, usuario, observacao } = req.body;
    if (!localizacaoId) return res.status(400).json({ error: 'localizacaoId é obrigatório' });

    const localizacao = await prisma.localizacao.findUnique({
      where: { id: localizacaoId },
      include: { setor: true }
    });
    if (!localizacao) return res.status(404).json({ error: 'Localização não encontrada' });

    // Bloquear transferência para setor "Lotes Fechados" diretamente
    if (localizacao.setor?.nome?.toUpperCase().includes('LOTES FECHADOS')) {
      return res.status(400).json({ error: 'Use a tela de Lotes para enviar itens para Lotes Fechados.' });
    }

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: { localizacaoId },
      include: { localizacao: { include: { setor: true } } }
    });

    await prisma.movimentacao.create({
      data: {
        id: uuidv4(),
        itemId: item.id,
        tipo: 'TRANSFERENCIA',
        motivo: 'TRANSFERENCIA',
        destino: localizacao.setor?.nome || localizacao.codigo,
        quantidade: item.quantidade,
        usuario: usuario || 'Sistema',
        observacao: observacao || `Transferido para ${localizacao.codigo}`
      }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao transferir item', details: error.message });
  }
});

// POST /api/items/:id/saida — Registrar saída de item
router.post('/:id/saida', async (req, res) => {
  try {
    const { motivo, destino, quantidade, usuario, observacao } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Motivo é obrigatório' });

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: { status: 'SAIU' },
      include: { localizacao: { include: { setor: true } } }
    });

    await prisma.movimentacao.create({
      data: {
        id: uuidv4(),
        itemId: item.id,
        tipo: 'SAIDA',
        motivo,
        destino,
        quantidade: quantidade || item.quantidade,
        usuario: usuario || 'Sistema',
        observacao
      }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar saída', details: error.message });
  }
});

// DELETE /api/items/:id - Deletar item
router.delete('/:id', async (req, res) => {
  try {
    await prisma.movimentacao.deleteMany({ where: { itemId: req.params.id } });
    await prisma.item.delete({ where: { id: req.params.id } });
    res.json({ message: 'Item deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar item', details: error.message });
  }
});

module.exports = router;
