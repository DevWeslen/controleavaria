const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

async function test() {
  const agent = new https.Agent({ rejectUnauthorized: false });
  const res = await axios.get('https://www.buscape.com.br/search?q=tv%2055%20polegadas', {
    httpsAgent: agent,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36' }
  });
  
  const $ = cheerio.load(res.data);
  
  // Method 1: finding images via data-testid
  const results = [];
  $('[data-testid="product-card::card"]').each((i, el) => {
      const title = $(el).find('[data-testid="product-card::name"]').text().trim();
      const price = $(el).find('[data-testid="product-card::price"]').text().trim();
      // Buscape uses images with src inside a picture tag or noscript
      const img = $(el).find('[data-testid="product-card::image"] img').attr('src') || $(el).find('img').attr('src') || $(el).find('img').attr('data-src');
      console.log('---');
      console.log(title, price, img);
  });
}
test();
