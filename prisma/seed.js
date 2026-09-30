const prisma = require('../lib/prisma');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('🌱 Populando banco de dados com dados iniciais...\n');

  // Criar setores baseados no mapa 3D
  const setores = [
    { id: uuidv4(), nome: 'Gaiola', descricao: 'Área da Gaiola', cor: '#E74C3C' },
    { id: uuidv4(), nome: 'Proc. Judicial', descricao: 'Processos Judiciais', cor: '#1ABC9C' },
    { id: uuidv4(), nome: 'Zero Residuos', descricao: 'Itens Zero Resíduos', cor: '#2ECC71' },
    { id: uuidv4(), nome: 'Debito', descricao: 'Itens em Débito', cor: '#E67E22' },
    { id: uuidv4(), nome: 'Tratativa Com.', descricao: 'Tratativa Comercial', cor: '#F1C40F' },
    { id: uuidv4(), nome: 'Novas Vendas', descricao: 'Itens para Novas Vendas', cor: '#27AE60' },
    { id: uuidv4(), nome: 'Seguro', descricao: 'Itens do Seguro', cor: '#3498DB' },
    { id: uuidv4(), nome: 'Lotes Fechados', descricao: 'Área de Lotes', cor: '#F59E0B' },
    { id: uuidv4(), nome: 'Sobras', descricao: 'Sobras em geral', cor: '#E74C3C' },
  ];

  for (const setor of setores) {
    await prisma.setor.upsert({
      where: { nome: setor.nome },
      update: {},
      create: {
        id: setor.id,
        nome: setor.nome,
        descricao: setor.descricao,
        cor: setor.cor,
        posicaoX: 0, posicaoY: 0, largura: 10, altura: 10 // Padrão
      }
    });
  }
  console.log('✅ Setores atualizados');

  const dbSetores = await prisma.setor.findMany();
  const getSetorId = (nome) => dbSetores.find(s => s.nome === nome)?.id;

  // Criar 1 localização (Genérica) por setor para mapear com o FrontEnd (dbId)
  const localizacoes = [
    { id: uuidv4(), codigo: 'GAI-CHAO', descricao: 'Área Gaiola', tipo: 'CHAO', setorId: getSetorId('Gaiola'), capacidade: 100 },
    { id: uuidv4(), codigo: 'PJ-CHAO', descricao: 'Área Proc. Judicial', tipo: 'CHAO', setorId: getSetorId('Proc. Judicial'), capacidade: 100 },
    { id: uuidv4(), codigo: 'ZR-CHAO', descricao: 'Área Zero Resíduos', tipo: 'CHAO', setorId: getSetorId('Zero Residuos'), capacidade: 100 },
    { id: uuidv4(), codigo: 'DB-CHAO', descricao: 'Área Débito', tipo: 'CHAO', setorId: getSetorId('Debito'), capacidade: 100 },
    { id: uuidv4(), codigo: 'TC-CHAO', descricao: 'Área Tratativa Comercial', tipo: 'CHAO', setorId: getSetorId('Tratativa Com.'), capacidade: 100 },
    { id: uuidv4(), codigo: 'NV-CHAO', descricao: 'Área Novas Vendas', tipo: 'CHAO', setorId: getSetorId('Novas Vendas'), capacidade: 300 },
    { id: uuidv4(), codigo: 'SEG-CHAO', descricao: 'Área Seguro', tipo: 'CHAO', setorId: getSetorId('Seguro'), capacidade: 200 },
    { id: uuidv4(), codigo: 'LOTES-GERAL', descricao: 'Área Lotes Fechados', tipo: 'CHAO', setorId: getSetorId('Lotes Fechados'), capacidade: 200 },
    { id: uuidv4(), codigo: 'SOB', descricao: 'Porta Pallet Sobras', tipo: 'PALETE', setorId: getSetorId('Sobras'), capacidade: 50 },
  ];

  for (const loc of localizacoes) {
    if(loc.setorId) {
      await prisma.localizacao.upsert({
        where: { codigo: loc.codigo },
        update: {},
        create: {
          id: loc.id,
          codigo: loc.codigo,
          descricao: loc.descricao,
          tipo: loc.tipo,
          setorId: loc.setorId,
          capacidade: loc.capacidade,
          posicaoX: 0, posicaoY: 0, posicaoZ: 0
        }
      });
    }
  }
  console.log('✅ Localizações base criadas com base no layout 3D');

  console.log('🎉 Seed concluído com sucesso!');
}

seed()
  .catch((e) => { console.error('❌ Erro no seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
