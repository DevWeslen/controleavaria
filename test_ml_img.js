const cheerio = require('cheerio');
const fs = require('fs');

function testSelectors() {
  const data = fs.readFileSync('ml_dump_real.html', 'utf8');
  const $ = cheerio.load(data);
  const items = $('.ui-search-layout__item').slice(0, 3);
  
  items.each((i, el) => {
    const title = $(el).find('.ui-search-item__title, .poly-component__title, h2').first().text().trim();
    
    // Test different img selectors
    const img1 = $(el).find('img.ui-search-result-image__element').attr('src');
    const img1d = $(el).find('img.ui-search-result-image__element').attr('data-src');
    const img2 = $(el).find('img.poly-component__picture').attr('src');
    const img2d = $(el).find('img.poly-component__picture').attr('data-src');
    const img3 = $(el).find('img').first().attr('src');
    const img3d = $(el).find('img').first().attr('data-src');
    const img4 = $(el).find('img[fetchpriority="high"]').attr('src');
    const img5 = $(el).find('.poly-card__portada img').attr('src') || $(el).find('.poly-card__portada img').attr('data-src');
    
    console.log(`\nItem ${i+1}: ${title}`);
    console.log(`img1 src:`, img1, `data-src:`, img1d);
    console.log(`img2 src:`, img2, `data-src:`, img2d);
    console.log(`img3 src:`, img3, `data-src:`, img3d);
    console.log(`img4 src:`, img4);
    console.log(`img5 src/data-src:`, img5);
  });
}
testSelectors();
