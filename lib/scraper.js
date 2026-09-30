const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

async function scrapePrices(query) {
  try {
    const searchUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(query).replace(/%20/g, '-')}`;
    
    // Agent para ignorar proxy/SSL corporativo
    const agent = new https.Agent({ rejectUnauthorized: false });
    
    const { data } = await axios.get(searchUrl, {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    $('.ui-search-layout__item').each((i, el) => {
      if (results.length >= 3) return false;
      
      const title = $(el).find('.ui-search-item__title, .poly-component__title, h2').first().text().trim();
      const priceStr = $(el).find('.andes-money-amount__fraction').first().text().replace(/\./g, '').trim();
      const link = $(el).find('.ui-search-link').attr('href') || searchUrl;
      const image = $(el).find('img.ui-search-result-image__element').attr('src') || $(el).find('img.ui-search-result-image__element').attr('data-src') || '';
      
      if (title && priceStr) {
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          results.push({ title, price, link, image });
        }
      }
    });

    if (results.length === 0) {
      return { success: false, message: 'Nenhum item encontrado na internet.', options: [] };
    }

    const sum = results.reduce((acc, curr) => acc + curr.price, 0);
    const average = sum / results.length;

    return {
      success: true,
      options: results,
      average: Number(average.toFixed(2))
    };

  } catch (error) {
    console.error('Erro no scraping com Axios:', error.message);
    return { success: false, message: 'Erro ao buscar valores na internet (Bloqueio do servidor).', options: [] };
  }
}

module.exports = { scrapePrices };
