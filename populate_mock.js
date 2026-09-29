require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function populate() {
  console.log("Iniciando populate...");
  // Localizações que queremos popular
  const locsToPopulate = [
    { codigo: 'SOB-C01-N1', qty: 45 },
    { codigo: 'SOB-C02-N2', qty: 20 },
    { codigo: 'SOB-C03-N3', qty: 10 },
    { codigo: 'GAI-CHAO', qty: 15 },
    { codigo: 'ZR-CHAO', qty: 8 },
    { codigo: 'PJ-CHAO', qty: 5 },
    { codigo: 'TC-CHAO', qty: 12 },
    { codigo: 'DB-CHAO', qty: 25 },
    { codigo: 'NV-CHAO', qty: 30 },
    { codigo: 'SEG-CHAO', qty: 2 },
    { codigo: 'AUT-CHAO', qty: 18 },
    { codigo: 'MOV-CHAO', qty: 7 }
  ];

  for(const l of locsToPopulate) {
    // Acha a localização
    const dbLoc = await prisma.localizacao.findUnique({ where: { codigo: l.codigo } });
    if(dbLoc) {
      // Cria itens falsos
      for(let i=0; i<l.qty; i++) {
        await prisma.item.create({
          data: {
            codigo: `MOCK-${l.codigo}-${Date.now()}-${i}`,
            nome: `Item de Teste ${i}`,
            quantidade: 1,
            localizacaoId: dbLoc.id,
            status: 'ESTOQUE'
          }
        });
      }
      console.log(`Adicionados ${l.qty} itens em ${l.codigo}`);
    } else {
      console.log(`Localização ${l.codigo} não encontrada, ignorando.`);
    }
  }
  console.log("Fim do populate!");
}

populate().catch(console.error).finally(() => prisma.$disconnect());
