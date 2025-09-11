import axios from 'axios';
import getCallerName from './getCallerName.js';
import { logger } from './logger.js';

/**
 * 아이템의 아이디와 이름을 한 쌍으로 해서 반환합니다.
 * 대소문자 구분은 없습니다
 * @param {Array} item [ plex , Rifter ] 배열 객체가 와야함
 * @returns 배열 객체 [ { id: 587, name: 'Rifter' } , { id: 44992, name: 'PLEX' } ]
 */
async function getItemId(item) {
    const payload = Array.isArray(item) ? item : [item];
    const res = await axios.post('https://esi.evetech.net/latest/universe/ids/', payload, {
        headers: { 'Content-Type': 'application/json' },
    });
    const hit = res.data.inventory_types; // : [ { id: 587, name: 'Rifter' } , { id: 44992, name: 'PLEX' } ]
    if (!hit) {
        logger().warn(
            `[getItemId] : 존재하지 않는 아이템 이름으로 조회가 이루어 졌습니다. : ${item}`
        );
        throw new Error('[getItemId] 존재하지 않는 아이템 이름으로 조회가 이루어 졌습니다.');
    }
    return hit.map(item => item.id);
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

export default async function eveCommercialAreaPrice(item, region) {
    const key = String(region).toLowerCase();
    const REGION = {
        jita: 10000002,
        amarr: 10000043,
        dodixie: 10000032,
        rens: 10000030,
    };

    if (!(key in REGION)) {
        logger().error(
            `[eveCommercialAreaPrice] 지원하지 않는 지역: ${region} 호출:${getCallerName()}`
        );
        throw new Error(`코드 오류 : 지원하지 않는 지역: ${region}`);
    }

    const chunkSize = 5; //병렬 처리 한번에 할 횟수 (이브 초당 rate limit은 20개)
    const itemIds = await getItemId(item);
    const results = [];

    for (let i = 0; i < itemIds.length; i += chunkSize) {
        const batch = itemIds.slice(i, i + chunkSize);
        const batchResults = await Promise.all(batch.map(id => getMarketData(id, REGION[key])));
        results.push(...batchResults);
    }

    return results;
}

const a = ['plex', 'Rifter'];
console.log(await eveCommercialAreaPrice(a, 'jita'));
