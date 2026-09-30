const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

async function testML() {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const { data } = await axios.get('https://lista.mercadolivre.com.br/tv', {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });
    const $ = cheerio.load(data);
    const results = [];

    $('.ui-search-layout__item').each((i, el) => {
      if (results.length >= 3) return false;
      
      const title = $(el).find('.ui-search-item__title').text().trim();
      const priceStr = $(el).find('.andes-money-amount__fraction').first().text().replace(/\./g, '').trim();
      console.log(`Title: ${title}, PriceStr: ${priceStr}`);
      if (title && priceStr) {
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          results.push({ title, price });
        }
      }
    });
    console.log("Results:", results);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testML();
