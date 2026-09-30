const axios = require('axios');
const cheerio = require('cheerio');
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
    const $ = cheerio.load(data);
    const items = $('.ui-search-layout__item');
    console.log("Items found:", items.length);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testML();
