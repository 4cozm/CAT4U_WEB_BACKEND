import axios from 'axios';
import { logger } from './logger.js';

async function getItemname(itemId, Language) {
    const res = await axios.get(`https://esi.evetech.net/latest/universe/types/${itemId}/`, {
        headers: { 'Accept-Language': Language },
    });

    const hit = res.data.name; // : [ { id: 587, name: 'Rifter' } , { id: 44992, name: 'PLEX' } ]
    if (!hit) {
        logger().warn('[getItemId] : 존재하지 않는 아이템 이름으로 조회가 이루어 졌습니다. ');
        throw new Error('[getItemId] 존재하지 않는 아이템 이름으로 조회가 이루어 졌습니다.');
    }
    return res.data.name;
}

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
    return res.data.id;
}

console.log(await getItemname(587, 'ko'));
console.log(await getItemId('Rifter'));
