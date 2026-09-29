const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function gerarCodigo(etiquetaNum) {
  if (etiquetaNum) return `ETQ-${String(etiquetaNum).padStart(5, '0')}`;
  return null;
}

async function atualizarPrecos() {
  console.log('Lendo planilha para atualizar preços...');
  const workbook = xlsx.readFile('./PENDÊNCIAS MATRIZ.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  let atualizados = 0;

  for (const row of data) {
    const codigo = gerarCodigo(row['ETIQUETA']);
    if (!codigo) continue;

    const valorNf = parseFloat(row['VALOR NF']) || null;
    const valorInternet = parseFloat(row['VALOR INTER.']) || null;
    
    // Calcula sugestão com base no que estiver preenchido (Prioridade para Internet, ou NF)
    let sugestao = null;
    if (valorInternet && valorInternet > 0) {
      sugestao = valorInternet * 0.4;
    } else if (valorNf && valorNf > 0) {
      sugestao = valorNf * 0.4;
    }

    if (valorNf || valorInternet || sugestao) {
      try {
        await prisma.item.update({
          where: { codigo },
          data: {
            valorNf,
            valorInternet,
            sugestao
          }
        });
        atualizados++;
      } catch (err) {
        // Ignora se o item não existir (caso a etiqueta seja inválida)
      }
    }
  }

  console.log(`Concluído! ${atualizados} itens foram atualizados com os valores de Nota Fiscal e Internet.`);
}

atualizarPrecos().catch(console.error).finally(() => prisma.$disconnect());
