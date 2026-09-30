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
    
    const link1 = $(el).find('a').first().attr('href');
    const link2 = $(el).find('.ui-search-link').attr('href');
    const link3 = $(el).find('a.poly-component__title').attr('href');
    
    console.log(`\nItem ${i+1}: ${title}`);
    console.log(`img5 src/data-src:`, img5);
    console.log(`link1:`, link1);
    console.log(`link2:`, link2);
    console.log(`link3:`, link3);
  });
}
testSelectors();
