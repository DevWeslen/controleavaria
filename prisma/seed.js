const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('🌱 Populando banco de dados com dados iniciais...\n');

  // Criar setores
  const setores = [
    {
      id: uuidv4(),
      nome: 'SEGURO',
      descricao: 'Itens de alto valor ou sensíveis',
      cor: '#E74C3C',
      posicaoX: 0,
      posicaoY: 0,
      largura: 12,
      altura: 8
    },
    {
      id: uuidv4(),
      nome: 'VENDA',
      descricao: 'Itens prontos para comercialização',
      cor: '#27AE60',
      posicaoX: 14,
      posicaoY: 0,
      largura: 12,
      altura: 8
    },
    {
      id: uuidv4(),
      nome: 'SOBRA',
      descricao: 'Sobras em paletes',
      cor: '#F39C12',
      posicaoX: 28,
      posicaoY: 0,
      largura: 12,
      altura: 8
    }
  ];

  for (const setor of setores) {
    await prisma.setor.upsert({
      where: { nome: setor.nome },
      update: {},
      create: setor
    });
  }
  console.log('✅ Setores criados: SEGURO, VENDA, SOBRA');

  // Buscar setores criados
  const setorSeguro = await prisma.setor.findUnique({ where: { nome: 'SEGURO' } });
  const setorVenda = await prisma.setor.findUnique({ where: { nome: 'VENDA' } });
  const setorSobra = await prisma.setor.findUnique({ where: { nome: 'SOBRA' } });

  // Criar localizações (paletes)
  const localizacoes = [
    // Seguro
    { id: uuidv4(), codigo: 'SEG-P01', descricao: 'Palete 1 - Seguro', tipo: 'PALETE', setorId: setorSeguro.id, posicaoX: 1, posicaoY: 0, posicaoZ: 1, capacidade: 20 },
    { id: uuidv4(), codigo: 'SEG-P02', descricao: 'Palete 2 - Seguro', tipo: 'PALETE', setorId: setorSeguro.id, posicaoX: 4, posicaoY: 0, posicaoZ: 1, capacidade: 20 },
    { id: uuidv4(), codigo: 'SEG-P03', descricao: 'Palete 3 - Seguro', tipo: 'PALETE', setorId: setorSeguro.id, posicaoX: 7, posicaoY: 0, posicaoZ: 1, capacidade: 20 },
    // Venda
    { id: uuidv4(), codigo: 'VEN-P01', descricao: 'Palete 1 - Venda', tipo: 'PALETE', setorId: setorVenda.id, posicaoX: 1, posicaoY: 0, posicaoZ: 1, capacidade: 30 },
    { id: uuidv4(), codigo: 'VEN-P02', descricao: 'Palete 2 - Venda', tipo: 'PALETE', setorId: setorVenda.id, posicaoX: 4, posicaoY: 0, posicaoZ: 1, capacidade: 30 },
    { id: uuidv4(), codigo: 'VEN-P03', descricao: 'Palete 3 - Venda', tipo: 'PALETE', setorId: setorVenda.id, posicaoX: 7, posicaoY: 0, posicaoZ: 1, capacidade: 30 },
    // Sobra
    { id: uuidv4(), codigo: 'SOB-P01', descricao: 'Palete 1 - Sobra', tipo: 'PALETE', setorId: setorSobra.id, posicaoX: 1, posicaoY: 0, posicaoZ: 1, capacidade: 50 },
    { id: uuidv4(), codigo: 'SOB-P02', descricao: 'Palete 2 - Sobra', tipo: 'PALETE', setorId: setorSobra.id, posicaoX: 4, posicaoY: 0, posicaoZ: 1, capacidade: 50 },
    { id: uuidv4(), codigo: 'SOB-P03', descricao: 'Palete 3 - Sobra', tipo: 'PALETE', setorId: setorSobra.id, posicaoX: 7, posicaoY: 0, posicaoZ: 1, capacidade: 50 },
    { id: uuidv4(), codigo: 'SOB-P04', descricao: 'Palete 4 - Sobra', tipo: 'PALETE', setorId: setorSobra.id, posicaoX: 10, posicaoY: 0, posicaoZ: 1, capacidade: 50 },
  ];

  for (const loc of localizacoes) {
    await prisma.localizacao.upsert({
      where: { codigo: loc.codigo },
      update: {},
      create: loc
    });
  }
  console.log('✅ Localizações (paletes) criadas');

  // Criar alguns itens de exemplo
  const locSEG01 = await prisma.localizacao.findUnique({ where: { codigo: 'SEG-P01' } });
  const locVEN01 = await prisma.localizacao.findUnique({ where: { codigo: 'VEN-P01' } });
  const locSOB01 = await prisma.localizacao.findUnique({ where: { codigo: 'SOB-P01' } });

  const itemsExemplo = [
    {
      id: uuidv4(),
      codigo: `AV-EXEMPLO-001`,
      nome: 'TV 55" Samsung - Tela trincada',
      descricao: 'Televisor com avaria na tela',
      quantidade: 1,
      motivoAvaria: 'Tela trincada no transporte',
      localizacaoId: locSEG01.id,
      status: 'ESTOQUE'
    },
    {
      id: uuidv4(),
      codigo: `AV-EXEMPLO-002`,
      nome: 'Geladeira Brastemp 400L',
      descricao: 'Amassado na lateral',
      quantidade: 2,
      motivoAvaria: 'Amassado na lateral',
      localizacaoId: locVEN01.id,
      status: 'ESTOQUE'
    },
    {
      id: uuidv4(),
      codigo: `AV-EXEMPLO-003`,
      nome: 'Caixas de embalagem papelão',
      descricao: 'Embalagens diversas',
      quantidade: 50,
      motivoAvaria: null,
      localizacaoId: locSOB01.id,
      status: 'ESTOQUE'
    }
  ];

  for (const item of itemsExemplo) {
    const existing = await prisma.item.findUnique({ where: { codigo: item.codigo } });
    if (!existing) {
      const created = await prisma.item.create({ data: item });
      await prisma.movimentacao.create({
        data: {
          id: uuidv4(),
          itemId: created.id,
          tipo: 'ENTRADA',
          motivo: 'CADASTRO',
          quantidade: created.quantidade,
          usuario: 'Sistema',
          observacao: 'Item de exemplo criado no seed'
        }
      });
    }
  }
  console.log('✅ Itens de exemplo criados\n');
  console.log('🎉 Seed concluído com sucesso!');
  console.log('   Acesse http://localhost:3000 para visualizar o sistema.\n');
}

seed()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
