const layout = [];

function addBlock(prefix, name, color, startX, startZ, rows, cols, palletsPerRow) {
  let count = 1;
  // A block is rows * cols, but drawn with spaces
  for(let r=0; r<rows; r++) {
    for(let c=0; c<cols; c++) {
      layout.push({
        id: `${prefix}-P${String(count).padStart(2, '0')}`,
        label: name,
        color: color,
        x: startX + c * 3.5,
        z: startZ + r * 4.5
      });
      count++;
    }
  }
}

// 1. Porta Pallet / Sobras (Vermelho) -> 3 rows of 8 pallets
addBlock('SOB', 'Porta Pallet (Sobras)', '#E74C3C', -25, -25, 3, 8, 8);

// 2. Zero Residuos (Verde escuro) -> 2 rows of 4 pallets (let's just do 2x2 or 2x4)
addBlock('ZR', 'Zero Residuos', '#2ECC71', -35, -5, 2, 2, 2);
addBlock('ZR', 'Zero Residuos', '#2ECC71', -25, -5, 2, 2, 2);

// 3. Proc. Judicial
addBlock('PJ', 'Proc. Judicial', '#1ABC9C', -15, -5, 2, 2, 2);

// 4. Tratativa Comercial
addBlock('TC', 'Tratativa Comercial', '#F1C40F', -35, 5, 2, 2, 2);
addBlock('TC', 'Tratativa Comercial', '#F1C40F', -25, 5, 2, 2, 2);

// 5. Debito
addBlock('DB', 'Debito', '#E67E22', -15, 5, 2, 2, 2);

// 6. Seguro (3 blocks)
addBlock('SEG', 'Seguro', '#3498DB', 10, -5, 2, 3, 3);
addBlock('SEG', 'Seguro', '#3498DB', 10, 5, 2, 3, 3);
addBlock('SEG', 'Seguro', '#3498DB', 10, 15, 2, 3, 3);

// 7. Automotivo
addBlock('AUT', 'Automotivo', '#9B59B6', 10, 25, 2, 3, 3);

// 8. Moveis
addBlock('MOV', 'Moveis', '#34495E', 10, 35, 2, 3, 3);

// Empty Areas (Novas vendas)
// Just decorative floors.

console.log(JSON.stringify(layout, null, 2));
