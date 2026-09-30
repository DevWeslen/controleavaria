require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateLocations() {
  console.log('Atualizando locações do estoque...');
  
  const setoresName = [
    { nome: 'Gaiola', cor: '#E74C3C' },
    { nome: 'Porta Pallet', cor: '#E74C3C' },
    { nome: 'Sobras (Porta Pallet)', cor: '#E74C3C' }, // keeping old one for retro-compatibility
    { nome: 'Zero Resíduos', cor: '#2ECC71' },
    { nome: 'Proc. Judicial', cor: '#1ABC9C' },
    { nome: 'Tratativa Comercial', cor: '#F1C40F' },
    { nome: 'Débito', cor: '#E67E22' },
    { nome: 'Novas Vendas', cor: '#27AE60' },
    { nome: 'Seguro', cor: '#3498DB' },
    { nome: 'Automotivo', cor: '#9B59B6' },
    { nome: 'Móveis', cor: '#34495E' }
  ];

  for(const s of setoresName) {
    let exist = await prisma.setor.findFirst({ where: { nome: s.nome } });
    if(!exist) {
      await prisma.setor.create({ data: { nome: s.nome, descricao: s.nome, cor: s.cor } });
    }
  }

  // Get Setores
  const allSetores = await prisma.setor.findMany();
  const sob = allSetores.find(s => s.nome.includes('Sobras'));
  const gai = allSetores.find(s => s.nome === 'Gaiola');
  const zr = allSetores.find(s => s.nome === 'Zero Resíduos');
  const pj = allSetores.find(s => s.nome === 'Proc. Judicial');
  const tc = allSetores.find(s => s.nome === 'Tratativa Comercial');
  const db = allSetores.find(s => s.nome === 'Débito');
  const nv = allSetores.find(s => s.nome === 'Novas Vendas');
  const seg = allSetores.find(s => s.nome === 'Seguro');
  const aut = allSetores.find(s => s.nome === 'Automotivo');
  const mov = allSetores.find(s => s.nome === 'Móveis');

  // Move all items temporarily to avoid constraint errors
  await prisma.item.updateMany({ data: { localizacaoId: null } });

  // Delete all old locations
  await prisma.localizacao.deleteMany();

  // Create new locations
  const locsToCreate = [];
  
  // Porta Pallet (Sobras): 8 Colunas, 3 Niveis
  if(sob) {
    for(let c=1; c<=8; c++) {
      for(let n=1; n<=3; n++) {
        locsToCreate.push({
          codigo: `SOB-C${String(c).padStart(2,'0')}-N${n}`,
          descricao: `Coluna ${c} - Nivel ${n}`,
          tipo: 'PORTA_PALLET',
          setorId: sob.id,
          posicaoX: 0, posicaoY: 0, posicaoZ: 0
        });
      }
    }
  }

  // Chão
  if(gai) locsToCreate.push({ codigo: 'GAI-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: gai.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(zr) locsToCreate.push({ codigo: 'ZR-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: zr.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(pj) locsToCreate.push({ codigo: 'PJ-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: pj.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(tc) locsToCreate.push({ codigo: 'TC-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: tc.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(db) locsToCreate.push({ codigo: 'DB-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: db.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(nv) locsToCreate.push({ codigo: 'NV-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: nv.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(seg) locsToCreate.push({ codigo: 'SEG-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: seg.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(aut) locsToCreate.push({ codigo: 'AUT-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: aut.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });
  if(mov) locsToCreate.push({ codigo: 'MOV-CHAO', descricao: 'Chão', tipo: 'CHAO', setorId: mov.id, posicaoX: 0, posicaoY: 0, posicaoZ: 0 });

  await prisma.localizacao.createMany({ data: locsToCreate });

  // Move all items to SOB-C01-N1 (first one) or ZR-CHAO
  const firstLoc = await prisma.localizacao.findFirst();
  if(firstLoc) {
    await prisma.item.updateMany({ data: { localizacaoId: firstLoc.id } });
  }

  console.log('Locações atualizadas com sucesso!');
}

updateLocations().catch(console.error).finally(() => prisma.$disconnect());
