// ESI 관련 요청들은 여기에

import axios from "axios";
import { logger } from "../utils/logger.js";

/**
 *
 * @param {*} access_token
 * @returns {CharacterID,CharacterName,ExpiresOn,Scopes,TokenType,CharacterOwnerHash,IntellectualProperty}
 */
export async function getCharacterInfo(access_token) {
    try {
        const response = await axios.get("https://login.eveonline.com/oauth/verify", {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        if (!response?.data) {
            logger().info(`getCharacterInfo 결과 없음 (access_token=${access_token})`);
            throw new Error("캐릭터 정보를 불러올 수 없음");
        }

        return response.data;
    } catch (e) {
        logger().info(`getCharacterInfo 실패: ${e.message}`);
        throw e;
    }
}

/**
 *
 * @param {*} character_id
 * @param {*} access_token
 * @returns [ { name: '<color=0xffFFD228><b>새끼 고양이</color></b>', title_id: 8 } ]
 */
export async function getCharacterRole(character_id, access_token) {
    try {
        const response = await axios.get(
            `https://esi.evetech.net/characters/${character_id}/titles`,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );

        if (!response?.data || response.data.length === 0) {
            logger().info(`getCharacterRole 결과 없음 (character_id=${character_id})`);
            throw new Error("캐릭터의 롤을 찾을 수 없음");
        }

        return response.data;
    } catch (e) {
        logger().info(`getCharacterRole 실패 (character_id=${character_id}): ${e.message}`);
        throw e;
    }
}

/**
 * 캐릭터의 코퍼레이션 고유번호를 가져오는 메서드
 * @param {*} character_id
 * @returns {string} 코퍼레이션 아이디 문자열
 */
export async function getCharacterCorpId(character_id) {
    try {
        const response = await axios.get(`https://esi.evetech.net/characters/${character_id}`);
        const corpId = response?.data?.corporation_id;

        if (!corpId) {
            logger().info(`코퍼레이션 정보가 없는 유저 [${character_id}]가 로그인 시도`);
            throw new Error("가입된 코퍼레이션 찾을 수 없음");
        }

        return corpId;
    } catch (e) {
        logger().info(`getCharacterCorpId 실패 (character_id=${character_id}): ${e.message}`);
        throw e;
    }
}
