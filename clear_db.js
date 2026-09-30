const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanDB() {
  await prisma.movimentacao.deleteMany({});
  await prisma.item.deleteMany({});
  await prisma.lote.deleteMany({});
  console.log("Banco de itens, lotes e movimentações limpos!");
  process.exit(0);
}
cleanDB();
