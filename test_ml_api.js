const axios = require('axios');
const https = require('https');

async function testMLApi() {
  try {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const { data } = await axios.get('https://api.mercadolibre.com/sites/MLB/search?q=Tv', {
      httpsAgent: agent
    });
    console.log("Results found:", data.results.length);
    console.log("First item:", data.results[0].title, data.results[0].price);
  } catch (e) {
    console.log("Error:", e.message);
  }
}
testMLApi();
