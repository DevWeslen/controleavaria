const puppeteer = require('puppeteer');

async function scrapePrices(query) {
  let browser;
  try {
    // Tenta Mercado Livre primeiro (menos restritivo para bots)
    const searchUrl = `https://lista.mercadolivre.com.br/${encodeURIComponent(query).replace(/%20/g, '-')}`;
    
    browser = await puppeteer.launch({
      headless: 'new', // ou true
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });

    const page = await browser.newPage();
    
    // Disfarça o Puppeteer
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Extrai dados da página do Mercado Livre
    const results = await page.evaluate((url) => {
      const items = Array.from(document.querySelectorAll('.ui-search-layout__item'));
      const parsed = [];
      
      for (let i = 0; i < items.length; i++) {
        if (parsed.length >= 3) break;
        
        const el = items[i];
        const titleEl = el.querySelector('.ui-search-item__title');
        const priceEl = el.querySelector('.andes-money-amount__fraction');
        const imgEl = el.querySelector('img.ui-search-result-image__element');
        
        if (titleEl && priceEl) {
          const title = titleEl.textContent.trim();
          const priceStr = priceEl.textContent.replace(/\./g, '').trim();
          const price = parseFloat(priceStr);
          const image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : '';
          
          if (!isNaN(price)) {
            parsed.push({ title, price, link: url, image });
          }
        }
      }
      return parsed;
    }, searchUrl);

    await browser.close();

    if (!results || results.length === 0) {
      return { success: false, message: 'Nenhum item encontrado no Mercado Livre.', options: [] };
    }

    const sum = results.reduce((acc, curr) => acc + curr.price, 0);
    const average = sum / results.length;

    return {
      success: true,
      options: results,
      average: Number(average.toFixed(2))
    };

  } catch (error) {
    if (browser) await browser.close();
    console.error('Erro no scraping com Puppeteer:', error.message);
    return { success: false, message: 'Erro ao buscar valores na internet (Bloqueio do servidor).', options: [] };
  }
}

module.exports = { scrapePrices };
