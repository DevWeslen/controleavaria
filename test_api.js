const axios = require('axios');
async function testAPI() {
  try {
    const { data } = await axios.get('http://localhost:3009/api/items/scrape/search?q=Tv');
    console.log(data);
  } catch(e) {
    console.error(e.response ? e.response.data : e.message);
  }
}
testAPI();
