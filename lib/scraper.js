const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

async function scrapePrices(query) {
  try {
    const searchUrl = `https://www.buscape.com.br/search?q=${encodeURIComponent(query)}`;
    
    const agent = new https.Agent({ rejectUnauthorized: false });
    
    const { data } = await axios.get(searchUrl, {
      httpsAgent: agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    $('[data-testid="product-card::card"]').each((i, el) => {
      if (results.length >= 3) return false;
      
      const title = $(el).find('[data-testid="product-card::name"]').text().trim();
      const priceStr = $(el).find('[data-testid="product-card::price"]').text().trim();
      const image = $(el).find('[data-testid="product-card::image"] img').attr('src') || $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      
      if (title && priceStr) {
        let rawPrice = priceStr.replace('R$', '').trim();
        rawPrice = rawPrice.split(' ')[0];
        const price = parseFloat(rawPrice.replace(/\./g, '').replace(',', '.'));
        
        if (!isNaN(price)) {
          results.push({ title, price, link: searchUrl, image });
        }
      }
    });

    if (results.length === 0) return { success: false, message: 'Nenhum item encontrado.', options: [] };

    const sum = results.reduce((acc, curr) => acc + curr.price, 0);
    const average = sum / results.length;

    return {
      success: true,
      options: results,
      average: Number(average.toFixed(2))
    };

  } catch (error) {
    console.error('Erro no scraping:', error.message);
    return { success: false, message: 'Erro ao buscar valores na internet.', options: [] };
  }
}

module.exports = { scrapePrices };
