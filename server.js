const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const fs = require('fs');
const selfsigned = require('selfsigned');
require('dotenv').config();

const itemRoutes = require('./routes/items');
const movimentacaoRoutes = require('./routes/movimentacoes');
const setorRoutes = require('./routes/setores');
const localizacaoRoutes = require('./routes/localizacoes');
const etiquetaRoutes = require('./routes/etiquetas');
const loteRoutes = require('./routes/lotes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'public')));

// =====================
// SSE — Server-Sent Events para tempo real
// =====================
const sseClients = [];

function emitSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try { client.res.write(payload); } catch (e) {}
  });
}

// Expõe para os routes usarem
app.locals.emitSSE = emitSSE;

// Endpoint SSE que o browser conecta
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Heartbeat para manter conexão viva
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n'); } catch(e) {}
  }, 20000);

  const client = { id: Date.now(), res };
  sseClients.push(client);

  req.on('close', () => {
    clearInterval(heartbeat);
    const idx = sseClients.findIndex(c => c.id === client.id);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// API Routes
app.use('/api/items', itemRoutes);
app.use('/api/movimentacoes', movimentacaoRoutes);
app.use('/api/setores', setorRoutes);
app.use('/api/localizacoes', localizacaoRoutes);
app.use('/api/etiquetas', etiquetaRoutes);
app.use('/api/lotes', loteRoutes);

// Rota de saúde da API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Servir o frontend para todas as outras rotas (SPA)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gerar ou carregar certificado autoassinado para HTTPS (necessário para a câmera no mobile)
const keyPath = path.join(__dirname, 'key.pem');
const certPath = path.join(__dirname, 'cert.pem');

function startServer(pemsObj) {
  const httpsOptions = {
    key: pemsObj.private,
    cert: pemsObj.cert
  };
  https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`\n🏭 Controle de Avarias rodando em HTTPS seguro (necessário para a câmera)`);
    console.log(`📡 Acesse localmente: https://localhost:${PORT}`);
    console.log(`\nAcesso na rede local: https://<seu-ip>:${PORT}\n`);
  });
}

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
  const pems = {
    private: fs.readFileSync(keyPath, 'utf8'),
    cert: fs.readFileSync(certPath, 'utf8')
  };
  startServer(pems);
} else {
  console.log('Gerando certificado HTTPS local pela primeira vez...');
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  selfsigned.generate(attrs, { days: 365, keySize: 2048 }).then(pemsGen => {
    fs.writeFileSync(keyPath, pemsGen.private);
    fs.writeFileSync(certPath, pemsGen.cert);
    startServer(pemsGen);
  }).catch(err => {
    console.error('Erro ao gerar certificado:', err);
  });
}

module.exports = app;
