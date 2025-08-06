//ESI 관련 요청들은 여기에

import axios from 'axios';

/**
 *
 * @param {*} access_token
 * @returns {CharacterID,CharacterName,ExpiresOn,Scopes,TokenType,CharacterOwnerHash,IntellectualProperty}
 */
export async function getCharacterInfo(access_token) {
    const response = await axios.get('https://login.eveonline.com/oauth/verify', {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });

    return response.data;
}
/**
 *
 * @param {*} character_id
 * @param {*} access_token
 * @returns [ { name: '<color=0xffFFD228><b>새끼 고양이</color></b>', title_id: 8 } ]
 */
export async function getCharacterRole(character_id, access_token) {
    const response = await axios.get(`https://esi.evetech.net/characters/${character_id}/titles`, {
        headers: {
            Authorization: `Bearer ${access_token}`,
        },
    });

    return response.data;
}

/**
 * 캐릭터의 코퍼레이션 고유번호를 가져오는 메서드
 * @param {*} character_id
 * @returns {string} 코퍼레이션 아이디 문자열
 */
export async function getCharacterCorpId(character_id) {
    const response = await axios.get(`https://esi.evetech.net/characters/${character_id}`);

    return response.data.corporation_id;
}
