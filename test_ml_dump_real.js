const axios = require('axios');
const fs = require('fs');
const https = require('https');

async function dumpML() {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const { data } = await axios.get('https://lista.mercadolivre.com.br/tv', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    fs.writeFileSync('ml_dump_real.html', data);
    console.log("Dumped to ml_dump_real.html");
  } catch (e) {
    console.log("Error:", e.message);
  }
}
dumpML();
