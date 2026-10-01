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

      // ============================================
      // BACKGROUND & BORDER
      // ============================================
      doc.rect(0, 0, larguraPt, alturaPt).fill('#FFFFFF');
      doc.rect(2, 2, larguraPt - 4, alturaPt - 4).lineWidth(1).stroke('#DDDDDD');

      // ============================================
      // HEADER BAR
      // ============================================
      const setorCor = '#000000'; // Forçado para preto para impressora térmica
      const headerHeight = mmToPt(11);
      // Fundo do header
      doc.rect(2, 2, larguraPt - 4, headerHeight).fill(setorCor);
      
      // Nome do setor (Alinhado à esquerda)
      doc.fillColor('#FFFFFF')
        .fontSize(mmToPt(4.0))
        .font('Helvetica-Bold')
        .text(
          (item.localizacao?.setor?.nome || 'SEM SETOR').toUpperCase(),
          padding,
          2 + mmToPt(3.5),
          { width: larguraPt - 2 * padding, height: headerHeight, align: 'left' }
        );

      // Logo da Princesa dos Campos (canto direito do header, se desejar manter)
      try {
        const logoPath = require('path').join(__dirname, '../public/logo.png');
        doc.image(logoPath, larguraPt - mmToPt(25) - padding, 2 + mmToPt(1.5), { height: mmToPt(8) });
      } catch (e) {
        // ignora erro da logo
      }

      // ============================================
      // CORPO (QR CODE + INFORMAÇÕES)
      // ============================================
      const bodyTop = 2 + headerHeight + mmToPt(6);
      const bodyLeft = padding;
      
      const qrSize = mmToPt(34); // ~96px proporcionais
      const textLeft = bodyLeft + qrSize + mmToPt(5);
      const textWidth = larguraPt - textLeft - padding;

      // 1. QR Code
      const qrData = item.codigo;
      const qrBuffer = await QRCode.toBuffer(qrData, {
        width: Math.round(qrSize),
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      doc.image(qrBuffer, bodyLeft, bodyTop, { width: qrSize, height: qrSize });

      // Código do item embaixo do QR Code (fonte mono/pequena)
      doc.fillColor('#888888')
        .fontSize(mmToPt(2.5))
        .font('Courier')
        .text(
          item.codigo,
          bodyLeft,
          bodyTop + qrSize + mmToPt(1),
          { width: qrSize, align: 'center' }
        );

      // 2. Informações do Item (Lado Direito)
      // Nome do Item
      doc.fillColor('#111111')
        .fontSize(mmToPt(4.5))
        .font('Helvetica-Bold')
        .text(
          item.nome,
          textLeft,
          bodyTop,
          { width: textWidth, height: mmToPt(12), lineBreak: true }
        );

      let currentTextY = doc.y + mmToPt(2); // Posição atual após o nome

      // Função auxiliar para os campos
      const drawField = (label, value) => {
        doc.fillColor('#555555').fontSize(mmToPt(3.2)).font('Helvetica-Bold')
           .text(`${label}: `, textLeft, currentTextY, { continued: true })
           .font('Helvetica').text(value);
        currentTextY = doc.y + mmToPt(1);
      };

      drawField('Cód', item.codigo);
      drawField('Local', item.localizacao?.codigo || 'N/A');
      drawField('Qtd', item.quantidade);
      drawField('Data', new Date(item.createdAt).toLocaleDateString('pt-BR'));

      // ============================================
      // CAIXA DE AVARIA (Abaixo do QR Code e Info)
      // ============================================
      let maxBodyY = Math.max(bodyTop + qrSize + mmToPt(4), currentTextY);
      
      if (item.motivoAvaria) {
        const avariaY = maxBodyY + mmToPt(2);
        const avariaHeight = mmToPt(6);
        // Fundo branco com borda para chamar atenção sem fundo cinza/colorido
        doc.rect(bodyLeft, avariaY, larguraPt - 2 * padding, avariaHeight).fill('#FFFFFF');
        doc.rect(bodyLeft, avariaY, larguraPt - 2 * padding, avariaHeight).lineWidth(1).stroke('#000000');
        
        // Texto da avaria em preto
        doc.fillColor('#000000')
          .fontSize(mmToPt(3.0))
          .font('Helvetica-Bold')
          .text(
            `⚠ ${item.motivoAvaria}`,
            bodyLeft + mmToPt(2),
            avariaY + mmToPt(1.5),
            { width: larguraPt - 2 * padding - mmToPt(4) }
          );
      }

      // ============================================
      // FOOTER
      // ============================================
      const footerTop = alturaPt - mmToPt(14);
      
      // Linha superior do footer
      doc.moveTo(padding, footerTop).lineTo(larguraPt - padding, footerTop).lineWidth(1).stroke('#000000');

      doc.fillColor('#000000')
        .fontSize(mmToPt(3.0))
        .font('Helvetica')
        .text(
          `Data de entrada: ${new Date(item.createdAt).toLocaleDateString('pt-BR')}`,
          padding,
          footerTop + mmToPt(3),
          { width: larguraPt - 2 * padding, align: 'center' }
        );

      doc.fillColor('#000000')
        .fontSize(mmToPt(2.8))
        .text(
          'AvariasControl — Princesa dos Campos',
          padding,
          footerTop + mmToPt(7),
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

    const qrData = item.codigo;

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
