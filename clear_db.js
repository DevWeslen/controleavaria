const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDB() {
  await prisma.movimentacao.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.lote.deleteMany({});
  await prisma.localizacao.deleteMany({});
  await prisma.setor.deleteMany({});
  console.log("Banco de itens, lotes, localizações e setores limpo com sucesso!");
  process.exit(0);
}
cleanDB();
