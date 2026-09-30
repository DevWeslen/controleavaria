const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

// Gerar código de lote
async function gerarCodigoLote() {
  const ano = new Date().getFullYear();
  const count = await prisma.lote.count();
  const seq = String(count + 1).padStart(4, '0');
  return `LOT-${ano}-${seq}`;
}

// GET /api/lotes — listar lotes
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const lotes = await prisma.lote.findMany({
      where,
      include: {
        itens: {
          include: { localizacao: { include: { setor: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(lotes);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar lotes', details: error.message });
  }
});

// GET /api/lotes/:id — detalhes de um lote
router.get('/:id', async (req, res) => {
  try {
    const lote = await prisma.lote.findUnique({
      where: { id: req.params.id },
      include: {
        itens: {
          include: {
            localizacao: { include: { setor: true } },
            movimentacoes: { orderBy: { createdAt: 'desc' }, take: 1 }
          }
        }
      }
    });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    res.json(lote);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lote', details: error.message });
  }
});

// GET /api/lotes/codigo/:codigo — buscar lote por código (para scanner)
router.get('/codigo/:codigo', async (req, res) => {
  try {
    const lote = await prisma.lote.findUnique({
      where: { codigo: req.params.codigo },
      include: {
        itens: {
          where: { status: 'ESTOQUE' },
          include: { localizacao: { include: { setor: true } } }
        }
      }
    });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    res.json(lote);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar lote', details: error.message });
  }
});

// POST /api/lotes — criar lote
router.post('/', async (req, res) => {
  try {
    const { nome, usuario, observacao } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome do lote é obrigatório' });

    const codigo = await gerarCodigoLote();

    const lote = await prisma.lote.create({
      data: {
        id: uuidv4(),
        codigo,
        nome,
        usuario,
        observacao,
        status: 'ABERTO'
      },
      include: { itens: true }
    });

    res.status(201).json(lote);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar lote', details: error.message });
  }
});

// POST /api/lotes/:id/itens — adicionar item ao lote
router.post('/:id/itens', async (req, res) => {
  try {
    const { itemId, itemCodigo } = req.body;

    const lote = await prisma.lote.findUnique({ where: { id: req.params.id } });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    if (lote.status === 'FECHADO') return res.status(400).json({ error: 'Lote já fechado. Não é possível adicionar itens.' });

    // Buscar item por id ou codigo
    let item;
    if (itemId) {
      item = await prisma.item.findUnique({ where: { id: itemId } });
    } else if (itemCodigo) {
      item = await prisma.item.findUnique({ where: { codigo: itemCodigo } });
    }

    if (!item) return res.status(404).json({ error: 'Item não encontrado' });
    if (item.status !== 'ESTOQUE') return res.status(400).json({ error: 'Item não está em estoque' });
    if (item.loteId) return res.status(400).json({ error: 'Item já pertence a um lote' });

    const updatedItem = await prisma.item.update({
      where: { id: item.id },
      data: { loteId: lote.id },
      include: { localizacao: { include: { setor: true } } }
    });

    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao adicionar item ao lote', details: error.message });
  }
});

// DELETE /api/lotes/:id/itens/:itemId — remover item do lote
router.delete('/:id/itens/:itemId', async (req, res) => {
  try {
    const lote = await prisma.lote.findUnique({ where: { id: req.params.id } });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    if (lote.status === 'FECHADO') return res.status(400).json({ error: 'Lote fechado. Não é possível remover itens.' });

    await prisma.item.update({
      where: { id: req.params.itemId },
      data: { loteId: null }
    });

    res.json({ message: 'Item removido do lote' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover item do lote', details: error.message });
  }
});

// POST /api/lotes/:id/fechar — fechar lote e mover itens para "Lotes Fechados"
router.post('/:id/fechar', async (req, res) => {
  try {
    const { usuario } = req.body;
    const lote = await prisma.lote.findUnique({
      where: { id: req.params.id },
      include: { itens: true }
    });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    if (lote.status === 'FECHADO') return res.status(400).json({ error: 'Lote já está fechado' });
    if (lote.itens.length === 0) return res.status(400).json({ error: 'Não é possível fechar um lote vazio' });

    // Buscar ou criar setor "Lotes Fechados"
    let setorLotes = await prisma.setor.findFirst({
      where: { nome: { contains: 'Lotes Fechados', mode: 'insensitive' } },
      include: { localizacoes: { take: 1 } }
    });

    if (!setorLotes) {
      setorLotes = await prisma.setor.create({
        data: {
          nome: 'Lotes Fechados',
          descricao: 'Setor para armazenamento de lotes fechados aguardando saída',
          cor: '#F59E0B',
          localizacoes: {
            create: { codigo: 'LOTES-GERAL', capacidade: 9999 }
          }
        },
        include: { localizacoes: { take: 1 } }
      });
    }

    const localizacaoLotesId = setorLotes.localizacoes[0].id;

    // Fechar o lote
    const loteFechado = await prisma.lote.update({
      where: { id: lote.id },
      data: {
        status: 'FECHADO',
        fechadoAt: new Date()
      }
    });

    // Mover todos os itens para o setor Lotes Fechados e registrar movimentação
    for (const item of lote.itens) {
      await prisma.item.update({
        where: { id: item.id },
        data: { localizacaoId: localizacaoLotesId }
      });

      await prisma.movimentacao.create({
        data: {
          id: uuidv4(),
          itemId: item.id,
          tipo: 'TRANSFERENCIA',
          motivo: 'LOTE_FECHADO',
          destino: `Lote ${lote.codigo} — ${lote.nome}`,
          quantidade: item.quantidade,
          usuario: usuario || 'Sistema',
          observacao: `Item movido para Lotes Fechados`
        }
      });
    }

    const result = await prisma.lote.findUnique({
      where: { id: lote.id },
      include: { itens: { include: { localizacao: { include: { setor: true } } } } }
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao fechar lote', details: error.message });
  }
});

// POST /api/lotes/:id/saida — registrar saída de todos os itens do lote
router.post('/:id/saida', async (req, res) => {
  try {
    const { motivo, destino, usuario, observacao } = req.body;
    if (!motivo) return res.status(400).json({ error: 'Motivo é obrigatório' });

    const lote = await prisma.lote.findUnique({
      where: { id: req.params.id },
      include: { itens: { where: { status: 'ESTOQUE' } } }
    });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    if (lote.itens.length === 0) return res.status(400).json({ error: 'Nenhum item em estoque neste lote' });

    // Dar saída em todos os itens
    for (const item of lote.itens) {
      await prisma.item.update({
        where: { id: item.id },
        data: { status: 'SAIU' }
      });
      await prisma.movimentacao.create({
        data: {
          id: uuidv4(),
          itemId: item.id,
          tipo: 'SAIDA',
          motivo: motivo || 'LOTE_SAIDA',
          destino: destino || `Lote ${lote.codigo}`,
          quantidade: item.quantidade,
          usuario: usuario || 'Sistema',
          observacao: observacao || `Saída em lote: ${lote.nome}`
        }
      });
    }

    res.json({ message: `${lote.itens.length} itens registrados com saída`, lote });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao registrar saída do lote', details: error.message });
  }
});

// DELETE /api/lotes/:id — excluir lote (apenas abertos sem itens)
router.delete('/:id', async (req, res) => {
  try {
    const lote = await prisma.lote.findUnique({
      where: { id: req.params.id },
      include: { itens: true }
    });
    if (!lote) return res.status(404).json({ error: 'Lote não encontrado' });
    if (lote.status === 'FECHADO') return res.status(400).json({ error: 'Lote fechado não pode ser excluído' });

    // Remove itens do lote antes
    await prisma.item.updateMany({
      where: { loteId: lote.id },
      data: { loteId: null }
    });

    await prisma.lote.delete({ where: { id: lote.id } });
    res.json({ message: 'Lote excluído' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir lote', details: error.message });
  }
});

module.exports = router;
