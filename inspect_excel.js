const xlsx = require('xlsx');

const workbook = xlsx.readFile('./PENDÊNCIAS MATRIZ.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

console.log("Colunas (Cabeçalho):", data[0]);
console.log("Primeira linha de dados:", data[1]);
