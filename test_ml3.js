const axios = require('axios');
const fs = require('fs');
const https = require('https');

async function testML() {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const { data } = await axios.get('https://lista.mercadolivre.com.br/tv-55', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });
    fs.writeFileSync('ml_dump.html', data);
    console.log("Dumped to ml_dump.html");
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testML();
