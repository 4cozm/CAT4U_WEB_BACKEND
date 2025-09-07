async function getItemId(item) {
  const res = await axios.post(
    'https://esi.evetech.net/latest/universe/ids/',
    [item],
    { headers: { 'Content-Type': 'application/json' } }
  );
  const hit = res.data.inventory_types?.[0];
  if (!hit) throw new Error('아이템을 찾을 수 없습니다.');
  return hit.id;
}

async function getMarketData(itemId, regionId) {
  const res = await axios.get(
    `https://esi.evetech.net/latest/markets/${regionId}/history/?type_id=${itemId}`
  );
  const history = Array.isArray(res.data) ? res.data : [];

  if (history.length === 0) {
    return { hasHistory: false, avgPrice: null, lowestPrice: null };
  }

  const last30 = history.slice(-30);
  const prices = last30.map(d => d.average);
  const avgPrice = prices.reduce((s, p) => s + p, 0) / prices.length;
  const lowestPrice = Math.min(...last30.map(d => d.lowest));

  return { hasHistory: true, avgPrice, lowestPrice };
}

async function JitaPrice(item, region) {
  const REGION = {
    jita: 10000002,
    amarr: 10000043,
    dodixie: 10000032,
    rens: 10000030,
  };
  const itemId = await getItemId(item);
  const key = String(region).toLowerCase();
  if(region === 'jita'){
        return await getMarketData(itemId, REGION.jita);
    }
    else if(region === 'amarr'){
        return await getMarketData(itemId, REGION.amarr);
    } 
    else if(region === 'dodixie'){
        return await getMarketData(itemId, REGION.dodixie);
    } 
    else if(region === 'rens'){
        return await getMarketData(itemId, REGION.rens);
    } 
    else{
        throw new Error('Invalid region specified. Please use "jita", "amarr", "dodixie", or "rens".');
    }
}
