const prisma = require('./lib/prisma');

async function test() {
  try {
    const setores = await prisma.setor.findMany({
      include: {
        localizacoes: {
          include: {
            itens: {
              where: { status: 'ESTOQUE' },
              select: { id: true, nome: true, codigo: true, quantidade: true, status: true, valorNf: true, valorInternet: true, sugestao: true }
            }
          }
        }
      }
    });
    console.log("Success! Items: ", setores.length);
  } catch(e) {
    console.error("Prisma Error: ", e);
  }
}
test();
