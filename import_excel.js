const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

function parseExcelDate(excelDate) {
  if (!excelDate) return new Date();
  if (typeof excelDate === 'number') {
    return new Date((excelDate - (25567 + 2)) * 86400 * 1000);
  } https://127.0.0.1:52988/static/artifacts/009a780c-0000-434b-9548-eb7d8d5962cd/.user_uploaded/media_1790699369783.png?csrf=a189ed45-b47a-4175-afa2-32899dea4840
  return new Date();
}

function gerarCodigo(etiquetaNum) {
  if (etiquetaNum) return `ETQ-${String(etiquetaNum).padStart(5, '0')}`;
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `AV-${timestamp}-${random}`;
}

async function importar() {
  console.log('Iniciando importação do Excel...');
  const workbook = xlsx.readFile('./PENDÊNCIAS MATRIZ.xlsx');
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  console.log(`Lidos ${data.length} itens da planilha.`);

  // Pega um palete "SOBRA" genérico para itens que não tem palete definido
  let locSobra = await prisma.localizacao.findFirst({
    where: { codigo: 'SOB-P01' }
  });

  if (!locSobra) {
    const setorSobra = await prisma.setor.findFirst({ where: { nome: 'SOBRA' } });
    if (setorSobra) {
      locSobra = await prisma.localizacao.create({
        data: {
          codigo: 'SOB-P01',
          descricao: 'Palete Importado',
          setorId: setorSobra.id
        }
      });
    }
  }

  let inseridos = 0;

  for (const row of data) {
    // Pegar nome do item
    const nome = String(row['ITEM'] || 'Item não identificado').trim();
    if (nome === 'Item não identificado' && !row['ETIQUETA']) continue; // Pula linhas vazias

    const quantidade = parseInt(row['QTD. VOL']) || 1;
    const codigo = gerarCodigo(row['ETIQUETA']);
    const motivoAvaria = row['DANO'] || row['OCO/MOTIVO'] || null;

    // Criar descrição a partir de outros campos úteis
    let descricaoParts = [];
    if (row['CLIENTE']) descricaoParts.push(`Cliente: ${row['CLIENTE']}`);
    if (row['NF']) descricaoParts.push(`NF: ${row['NF']}`);
    if (row['CTE']) descricaoParts.push(`CTE: ${row['CTE']}`);
    if (row['DISPOSIÇÃO']) descricaoParts.push(`Disposição: ${row['DISPOSIÇÃO']}`);
    if (row['STATUS']) descricaoParts.push(`Status Planilha: ${row['STATUS']}`);
    if (row['PALLET']) descricaoParts.push(`Pallet Planilha: ${row['PALLET']}`);

    const descricao = descricaoParts.length > 0 ? descricaoParts.join(' | ') : null;

    // Se no excel diz que tem destino (ex: VENDIDO, SUCATA) podemos marcar como 'SAIU',
    // mas por garantia, vamos considerar 'ESTOQUE' a princípio e colocar nas observações
    let statusFinal = 'ESTOQUE';
    if (String(row['STATUS']).toUpperCase() === 'BAIXADO') {
      statusFinal = 'SAIU';
    }

    try {
      // Cria o item
      const item = await prisma.item.create({
        data: {
          codigo,
          nome,
          descricao,
          quantidade,
          motivoAvaria: motivoAvaria ? String(motivoAvaria) : null,
          localizacaoId: locSobra ? locSobra.id : null,
          status: statusFinal,
          createdAt: parseExcelDate(row['DATA ENTRADA'])
        }
      });

      // Cria a movimentação de entrada
      await prisma.movimentacao.create({
        data: {
          itemId: item.id,
          tipo: 'ENTRADA',
          motivo: 'IMPORTACAO_EXCEL',
          quantidade: item.quantidade,
          usuario: row['RESP. CHEGADA'] || 'Sistema Importador',
          observacao: 'Importado via planilha inicial'
        }
      });

      inseridos++;

      if (statusFinal === 'SAIU') {
        await prisma.movimentacao.create({
          data: {
            itemId: item.id,
            tipo: 'SAIDA',
            motivo: row['DISPOSIÇÃO'] || 'BAIXADO_NA_PLANILHA',
            quantidade: item.quantidade,
            usuario: 'Sistema Importador',
            observacao: 'Item já constava como finalizado na planilha'
          }
        });
      }

    } catch (err) {
      console.error(`Erro ao importar item ${codigo}:`, err.message);
    }
  }

  console.log(`\nImportação concluída! ${inseridos} itens inseridos no sistema.`);
}

importar().catch(e => console.error(e)).finally(() => prisma.$disconnect());
