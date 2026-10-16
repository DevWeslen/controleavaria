const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware, optionalAuth, requireRole } = require('../lib/auth');

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

// ---- Helpers de agregação por unidade de medida (UN / CX) ----
function novoBucket() {
  return {
    registros: 0,
    caixas: 0,
    unidadesAvulsas: 0,
    unidadesEmCaixas: 0,
    totalUnidades: 0,
    caixasSemInfo: 0 // caixas sem "itens por caixa" informado
  };
}

function somarNoBucket(b, unidadeMedida, itensPorCaixa, qtd) {
  const q = Number(qtd) || 0;
  b.registros += 1;
  if (unidadeMedida === 'CX') {
    b.caixas += q;
    if (itensPorCaixa) b.unidadesEmCaixas += q * itensPorCaixa;
    else b.caixasSemInfo += q;
  } else {
    b.unidadesAvulsas += q;
  }
  b.totalUnidades = b.unidadesAvulsas + b.unidadesEmCaixas;
  return b;
}

// GET /api/items/stats/dashboard - Estatísticas detalhadas para dashboard
router.get('/stats/dashboard', async (req, res) => {
  try {
    const [itens, setores, ultimasMovimentacoes, movimentacoes] = await Promise.all([
      prisma.item.findMany({
        select: {
          id: true, codigo: true, nome: true, quantidade: true, unidadeMedida: true,
          itensPorCaixa: true, status: true, motivoAvaria: true, loteId: true,
          valorNf: true, valorInternet: true, sugestao: true,
          localizacao: { select: { setorId: true } }
        }
      }),
      prisma.setor.findMany({
        include: { localizacoes: { include: { _count: { select: { itens: true } } } } }
      }),
      prisma.movimentacao.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { item: true }
      }),
      prisma.movimentacao.findMany({
        select: {
          tipo: true, motivo: true, quantidade: true, createdAt: true,
          item: { select: { unidadeMedida: true, itensPorCaixa: true } }
        }
      })
    ]);

    const estoqueItens = itens.filter(i => i.status === 'ESTOQUE');
    const total = itens.length;
    const emEstoque = estoqueItens.length;
    const saidos = itens.filter(i => i.status === 'SAIU').length;

    // Posição geral: estoque atual (itens), entradas e saídas (movimentações)
    const estoque = novoBucket();
    estoqueItens.forEach(i => somarNoBucket(estoque, i.unidadeMedida, i.itensPorCaixa, i.quantidade));

    const entradas = novoBucket();
    const saidas = novoBucket();
    const motivosMap = {};
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const limites = {
      hoje: inicioHoje,
      ultimos7dias: new Date(inicioHoje.getTime() - 6 * 86400000),
      ultimos30dias: new Date(inicioHoje.getTime() - 29 * 86400000)
    };
    const periodos = {};
    Object.keys(limites).forEach(k => {
      periodos[k] = { entradas: novoBucket(), saidas: novoBucket(), transferencias: 0 };
    });

    movimentacoes.forEach(m => {
      const un = m.item?.unidadeMedida || 'UN';
      const ipc = m.item?.itensPorCaixa || null;
      if (m.tipo === 'ENTRADA') somarNoBucket(entradas, un, ipc, m.quantidade);
      if (m.tipo === 'SAIDA') {
        somarNoBucket(saidas, un, ipc, m.quantidade);
        const chave = m.motivo || 'OUTROS';
        if (!motivosMap[chave]) motivosMap[chave] = { motivo: chave, ...novoBucket() };
        somarNoBucket(motivosMap[chave], un, ipc, m.quantidade);
      }
      Object.keys(limites).forEach(k => {
        if (new Date(m.createdAt) >= limites[k]) {
          if (m.tipo === 'ENTRADA') somarNoBucket(periodos[k].entradas, un, ipc, m.quantidade);
          else if (m.tipo === 'SAIDA') somarNoBucket(periodos[k].saidas, un, ipc, m.quantidade);
          else if (m.tipo === 'TRANSFERENCIA') periodos[k].transferencias += 1;
        }
      });
    });

    // Estoque por setor (com ocupação)
    const porSetorDetalhado = setores.map(s => {
      const bucket = novoBucket();
      estoqueItens
        .filter(i => i.localizacao?.setorId === s.id)
        .forEach(i => somarNoBucket(bucket, i.unidadeMedida, i.itensPorCaixa, i.quantidade));
      const capacidade = s.localizacoes.reduce((a, l) => a + (l.capacidade || 0), 0);
      const paletes = s.localizacoes.length;
      return { id: s.id, nome: s.nome, cor: s.cor, paletes, capacidade, ...bucket };
    });
    const semLocal = novoBucket();
    estoqueItens.filter(i => !i.localizacao).forEach(i =>
      somarNoBucket(semLocal, i.unidadeMedida, i.itensPorCaixa, i.quantidade));
    if (semLocal.registros > 0) {
      porSetorDetalhado.push({ id: null, nome: 'Sem localização', cor: '#64748B', paletes: 0, capacidade: 0, ...semLocal });
    }

    // Motivos de avaria (estoque atual)
    const avariaMap = {};
    estoqueItens.forEach(i => {
      const chave = (i.motivoAvaria || '').trim() || 'Não informado';
      if (!avariaMap[chave]) avariaMap[chave] = { motivo: chave, ...novoBucket() };
      somarNoBucket(avariaMap[chave], i.unidadeMedida, i.itensPorCaixa, i.quantidade);
    });

    // Top produtos em estoque (agrupado por nome)
    const prodMap = {};
    estoqueItens.forEach(i => {
      const chave = i.nome.trim().toUpperCase();
      if (!prodMap[chave]) prodMap[chave] = { nome: i.nome, ...novoBucket() };
      somarNoBucket(prodMap[chave], i.unidadeMedida, i.itensPorCaixa, i.quantidade);
    });

    // Lotes
    const comLote = novoBucket();
    const semLote = novoBucket();
    estoqueItens.forEach(i =>
      somarNoBucket(i.loteId ? comLote : semLote, i.unidadeMedida, i.itensPorCaixa, i.quantidade));

    // Valores (por registro em estoque)
    const valores = estoqueItens.reduce((acc, i) => {
      acc.valorNf += i.valorNf || 0;
      acc.valorInternet += i.valorInternet || 0;
      acc.sugestao += i.sugestao || 0;
      return acc;
    }, { valorNf: 0, valorInternet: 0, sugestao: 0 });

    const ordenar = (arr) => arr.sort((a, b) => b.totalUnidades - a.totalUnidades || b.caixas - a.caixas);

    res.json({
      // Compatibilidade com versão anterior
      total,
      emEstoque,
      saidos,
      porSetor: setores,
      ultimasMovimentacoes,
      saidasAgrupadas: Object.values(motivosMap).map(m => ({ motivo: m.motivo, _sum: { quantidade: m.caixas + m.unidadesAvulsas } })),
      // Detalhamento por unidade de medida
      resumo: {
        registros: { total, emEstoque, saidos },
        estoque,
        entradas,
        saidas
      },
      setoresDetalhado: porSetorDetalhado,
      periodos,
      saidasPorMotivo: ordenar(Object.values(motivosMap)),
      motivosAvaria: ordenar(Object.values(avariaMap)),
      topProdutos: ordenar(Object.values(prodMap)).slice(0, 8),
      lotes: { comLote, semLote },
      valores
    });
  } catch (error) {
    console.error(error);
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

// POST /api/items - Cadastrar novo item (OPERADOR, GESTOR, ADMIN)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { nome, descricao, quantidade, motivoAvaria, localizacaoId, usuario, valorNf, valorInternet, sugestao, unidadeMedida, itensPorCaixa } = req.body;
    
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    const codigo = gerarCodigo();
    const responsavel = req.user?.nome || usuario || 'Sistema';
    
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
        usuario: responsavel,
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

// PUT /api/items/:id - Atualizar item (Apenas GESTOR e ADMIN)
router.put('/:id', authMiddleware, requireRole('ADMIN', 'GESTOR'), async (req, res) => {
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

// POST /api/items/:id/transferir — Transferir item para outro setor/localizacao (OPERADOR, GESTOR, ADMIN)
router.post('/:id/transferir', authMiddleware, async (req, res) => {
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

    const responsavel = req.user?.nome || usuario || 'Sistema';

    await prisma.movimentacao.create({
      data: {
        id: uuidv4(),
        itemId: item.id,
        tipo: 'TRANSFERENCIA',
        motivo: 'TRANSFERENCIA',
        destino: localizacao.setor?.nome || localizacao.codigo,
        quantidade: item.quantidade,
        usuario: responsavel,
        observacao: observacao || `Transferido para ${localizacao.codigo}`
      }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao transferir item', details: error.message });
  }
});

// POST /api/items/:id/saida — Registrar saída de item (OPERADOR, GESTOR, ADMIN)
router.post('/:id/saida', authMiddleware, async (req, res) => {
  try {
    const { motivo, destino, quantidade, usuario, observacao } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Motivo é obrigatório' });

    const item = await prisma.item.update({
      where: { id: req.params.id },
      data: { status: 'SAIU' },
      include: { localizacao: { include: { setor: true } } }
    });

    const responsavel = req.user?.nome || usuario || 'Sistema';

    await prisma.movimentacao.create({
      data: {
        id: uuidv4(),
        itemId: item.id,
        tipo: 'SAIDA',
        motivo,
        destino,
        quantidade: quantidade || item.quantidade,
        usuario: responsavel,
        observacao
      }
    });

    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar saída', details: error.message });
  }
});

// DELETE /api/items/:id - Deletar item (Apenas GESTOR e ADMIN)
router.delete('/:id', authMiddleware, requireRole('ADMIN', 'GESTOR'), async (req, res) => {
  try {
    await prisma.movimentacao.deleteMany({ where: { itemId: req.params.id } });
    await prisma.item.delete({ where: { id: req.params.id } });
    res.json({ message: 'Item deletado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar item', details: error.message });
  }
});

module.exports = router;
