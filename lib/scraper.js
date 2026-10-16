const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
};

function decodeHtmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Raspa preços e produtos do Buscapé ou Zoom (Mosaico)
 */
async function scrapeMosaico(site, query) {
  const domain = site === 'zoom' ? 'https://www.zoom.com.br' : 'https://www.buscape.com.br';
  const url = `${domain}/search?q=${encodeURIComponent(query)}`;

  const res = await axios.get(url, {
    httpsAgent: agent,
    headers: DEFAULT_HEADERS,
    timeout: 8000
  });

  const $ = cheerio.load(res.data);
  const results = [];

  $('[data-testid="product-card::card"]').each((i, el) => {
    if (results.length >= 4) return false;

    const rawTitle = $(el).find('[data-testid="product-card::name"]').text().trim();
    const title = decodeHtmlEntities(rawTitle);
    const priceText = $(el).find('[data-testid="product-card::price"]').text().trim();

    let href = $(el).attr('href') || $(el).find('a').first().attr('href') || '';
    if (href && !href.startsWith('http')) {
      href = `${domain}${href}`;
    }

    let image = $(el).find('img').first().attr('src') ||
                $(el).find('img').first().attr('data-src') ||
                '';

    if (title && priceText) {
      // Formata "R$ 1.299,90" -> 1299.90
      const cleanPrice = priceText.replace(/[^\d,]/g, '').replace(',', '.');
      const price = parseFloat(cleanPrice);

      if (!isNaN(price) && price > 0) {
        results.push({
          title,
          price,
          link: href || url,
          image
        });
      }
    }
  });

  return results;
}

/**
 * Função principal chamada pelas rotas da API
 */
async function scrapePrices(query) {
  if (!query || !query.trim()) {
    return { success: false, message: 'Termo de busca vazio.', options: [] };
  }

  const cleanQuery = query.trim();

  try {
    // 1. Tentar no Buscapé
    let results = await scrapeMosaico('buscape', cleanQuery).catch(err => {
      console.warn('Scraper Buscapé falhou, tentando fallback:', err.message);
      return [];
    });

    // 2. Fallback para o Zoom se Buscapé não retornar itens
    if (!results || results.length === 0) {
      results = await scrapeMosaico('zoom', cleanQuery).catch(err => {
        console.warn('Scraper Zoom falhou:', err.message);
        return [];
      });
    }

    if (!results || results.length === 0) {
      return {
        success: false,
        message: 'Nenhum item encontrado na internet.',
        options: []
      };
    }

    const sum = results.reduce((acc, curr) => acc + curr.price, 0);
    const average = Number((sum / results.length).toFixed(2));

    return {
      success: true,
      options: results,
      average
    };

  } catch (error) {
    console.error('Erro geral no scraper de preços:', error.message);
    return {
      success: false,
      message: 'Erro ao consultar preços na internet.',
      options: []
    };
  }
}

module.exports = { scrapePrices };
