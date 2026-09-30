const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');

// POST /api/etiquetas/gerar - Gerar etiqueta(s) em PDF
router.post('/gerar', async (req, res) => {
  try {
    const { itemIds, larguraMM = 90, alturaMM = 100 } = req.body; // Etiqueta 52: 9cm x 10cm

    if (!itemIds || !itemIds.length) {
      return res.status(400).json({ error: 'Informe ao menos um itemId' });
    }

    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      include: { localizacao: { include: { setor: true } } }
    });

    if (!items.length) return res.status(404).json({ error: 'Nenhum item encontrado' });

    // Converter MM para pontos (1mm ≈ 2.8346 pontos)
    const mmToPt = (mm) => mm * 2.8346;
    const larguraPt = mmToPt(larguraMM);   // ~255pt para 90mm
    const alturaPt  = mmToPt(alturaMM);    // ~284pt para 100mm
    const padding   = mmToPt(5);           // margem interna 5mm

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=etiquetas_${Date.now()}.pdf`);

    const doc = new PDFDocument({
      size: [larguraPt, alturaPt],
      margin: 0,
      autoFirstPage: false
    });

    doc.pipe(res);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      doc.addPage({ size: [larguraPt, alturaPt], margin: 0 });

      // Background
      doc.rect(0, 0, larguraPt, alturaPt).fill('#FFFFFF');
      
      // Borda
      doc.rect(2, 2, larguraPt - 4, alturaPt - 4)
        .lineWidth(1)
        .stroke('#333333');

      // Header colorido por setor — altura proporcional a 100mm
      const setorCor = item.localizacao?.setor?.cor || '#4A90D9';
      const headerAltura = mmToPt(16); // Aumentado um pouco para caber logo e texto
      doc.rect(2, 2, larguraPt - 4, headerAltura).fill(setorCor);

      // Nome do setor no header (maior)
      doc.fillColor('#FFFFFF')
        .fontSize(mmToPt(4.5))
        .font('Helvetica-Bold')
        .text(
          item.localizacao?.setor?.nome || 'SEM SETOR',
          padding,
          2 + mmToPt(2),
          { width: larguraPt * 0.45, height: headerAltura }
        );

      // Identificador "Torre de Controle"
      doc.fillColor('#FFFFFF')
        .fontSize(mmToPt(3.5))
        .font('Helvetica-Bold')
        .text(
          'TORRE DE CONTROLE',
          padding,
          2 + mmToPt(9),
          { width: larguraPt * 0.45 }
        );

      // Logo da Princesa dos Campos (canto direito do header)
      try {
        const logoPath = require('path').join(__dirname, '../public/logo.png');
        doc.image(logoPath, larguraPt - mmToPt(25) - padding, 2 + mmToPt(2), { height: mmToPt(12) });
      } catch (e) {
        // Se a logo não existir ou falhar, coloca apenas a data
        console.error("Erro ao carregar logo:", e.message);
      }

      // Corpo da etiqueta — com espaço aproveitado na vertical
      const bodyTop  = 2 + headerAltura + mmToPt(3);
      const bodyLeft = padding;
      const qrSize   = mmToPt(32);   // QR maior: 32mm
      const textAreaLeft  = bodyLeft + qrSize + mmToPt(4);
      const textAreaWidth = larguraPt - textAreaLeft - padding;

      // Gerar QR Code com as informações do item
      const qrData = JSON.stringify({
        id: item.id,
        codigo: item.codigo,
        nome: item.nome,
        local: item.localizacao?.codigo || '',
      });
      
      const qrBuffer = await QRCode.toBuffer(qrData, {
        width: Math.round(qrSize),
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      });

      doc.image(qrBuffer, bodyLeft, bodyTop, { width: qrSize, height: qrSize });

      // Código abaixo do QR
      doc.fillColor('#666666')
        .fontSize(mmToPt(2.4))
        .font('Helvetica')
        .text(
          item.codigo,
          bodyLeft,
          bodyTop + qrSize + mmToPt(1),
          { width: qrSize, align: 'center' }
        );

      // Informações do item — fonte maior aproveitando 100mm
      doc.fillColor('#111111')
        .fontSize(mmToPt(4.5))
        .font('Helvetica-Bold')
        .text(
          item.nome,
          textAreaLeft,
          bodyTop,
          { width: textAreaWidth, height: mmToPt(14), lineBreak: true }
        );

      doc.fillColor('#333333')
        .fontSize(mmToPt(3.2))
        .font('Helvetica-Bold')
        .text(
          `Cód: `,
          textAreaLeft,
          bodyTop + mmToPt(15),
          { continued: true, width: textAreaWidth }
        )
        .font('Helvetica')
        .text(item.codigo);

      doc.fillColor('#444444')
        .fontSize(mmToPt(3.2))
        .font('Helvetica')
        .text(
          `Local: ${item.localizacao?.codigo || 'N/A'}`,
          textAreaLeft,
          bodyTop + mmToPt(20),
          { width: textAreaWidth }
        );

      doc.text(
        `Qtd: ${item.quantidade}`,
        textAreaLeft,
        bodyTop + mmToPt(25),
        { width: textAreaWidth }
      );

      if (item.motivoAvaria) {
        doc.fillColor('#CC3333')
          .fontSize(mmToPt(3))
          .font('Helvetica-Bold')
          .text(
            `⚠ ${item.motivoAvaria}`,
            bodyLeft,
            bodyTop + qrSize + mmToPt(8),
            { width: larguraPt - 2 * padding }
          );
      }

      // Rodapé
      const footerTop = alturaPt - mmToPt(10);
      doc.moveTo(2, footerTop).lineTo(larguraPt - 2, footerTop).stroke('#CCCCCC');

      doc.fillColor('#555555')
        .fontSize(mmToPt(3))
        .font('Helvetica')
        .text(
          `Data de entrada: ${new Date(item.createdAt).toLocaleDateString('pt-BR')}`,
          bodyLeft,
          footerTop + mmToPt(2),
          { width: larguraPt - 2 * padding, align: 'left' }
        );

      doc.fillColor('#888888')
        .fontSize(mmToPt(2.5))
        .text(
          'Torre de Controle — Princesa dos Campos',
          bodyLeft,
          footerTop + mmToPt(6),
          { width: larguraPt - 2 * padding, align: 'center' }
        );
    }

    doc.end();
  } catch (error) {
    console.error('Erro ao gerar etiqueta:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro ao gerar etiqueta', details: error.message });
    }
  }
});

// GET /api/etiquetas/preview/:id - Preview de uma etiqueta
router.get('/preview/:id', async (req, res) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: req.params.id },
      include: { localizacao: { include: { setor: true } } }
    });

    if (!item) return res.status(404).json({ error: 'Item não encontrado' });

    const qrData = JSON.stringify({
      id: item.id,
      codigo: item.codigo,
      nome: item.nome,
      local: item.localizacao?.codigo || '',
    });

    const qrDataUrl = await QRCode.toDataURL(qrData, { width: 200, margin: 1 });

    res.json({
      item,
      qrCode: qrDataUrl,
      localizacao: item.localizacao?.codigo || 'Sem localização',
      setor: item.localizacao?.setor?.nome || 'Sem setor',
      setorCor: item.localizacao?.setor?.cor || '#4A90D9'
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar preview', details: error.message });
  }
});

module.exports = router;
