const prisma = require('./lib/prisma');

async function fixSectors() {
  try {
    console.log("Iniciando conversao de setores...");

    // Buscar "Lotes Fechados" ou criar
    let setorLotes = await prisma.setor.findFirst({
      where: { nome: { contains: 'Lotes Fechados', mode: 'insensitive' } },
      include: { localizacoes: true }
    });

    if (!setorLotes) {
      setorLotes = await prisma.setor.create({
        data: {
          nome: 'Lotes Fechados',
          descricao: 'Setor para armazenamento de lotes de leilão',
          cor: '#F59E0B',
          posicaoX: 20, // posicao arbitraria para visualizacao 3D
          posicaoY: 20,
          largura: 20,
          altura: 20,
          localizacoes: {
            create: { codigo: 'LOTES-GERAL', capacidade: 9999 }
          }
        },
        include: { localizacoes: true }
      });
      console.log("Criou setor Lotes Fechados com ID:", setorLotes.id);
    }

    const localizacaoLotesId = setorLotes.localizacoes[0].id;

    // Buscar Moveis e Automotivo
    const setoresAntigos = await prisma.setor.findMany({
      where: {
        OR: [
          { nome: { contains: 'Moveis', mode: 'insensitive' } },
          { nome: { contains: 'Móveis', mode: 'insensitive' } },
          { nome: { contains: 'Automotivo', mode: 'insensitive' } }
        ]
      },
      include: { localizacoes: true }
    });

    for (const setor of setoresAntigos) {
      console.log(`Encontrado setor antigo: ${setor.nome} (${setor.id})`);
      
      for (const loc of setor.localizacoes) {
        // Transferir todos os itens para o Lotes Fechados
        const update = await prisma.item.updateMany({
          where: { localizacaoId: loc.id },
          data: { localizacaoId: localizacaoLotesId }
        });
        console.log(`Moveu ${update.count} itens da localizacao ${loc.codigo} para Lotes Fechados`);
        
        // Deletar a localizacao antiga
        await prisma.localizacao.delete({ where: { id: loc.id } });
      }

      // Deletar o setor
      await prisma.setor.delete({ where: { id: setor.id } });
      console.log(`Setor ${setor.nome} excluido!`);
    }

    console.log("Concluido!");
  } catch(e) {
    console.error("Erro: ", e);
  } finally {
    await prisma.$disconnect();
  }
}

fixSectors();
