import axios from "axios";
import { Buffer } from "buffer";
import { URLSearchParams } from "url";
import { extractTags, isAllowedCorp } from "../utils/eveRoleUtils.js";
import { logger } from "../utils/logger.js";
import { getCharacterCorpId, getCharacterInfo, getCharacterRole } from "./eveEsiService.js";
import { createJwt } from "./jwtService.js";
import prisma from "./prismaService.js";

/**
 *
 * @param {*} code authorized code
 * @param {*} loginIp req.ip
 * @returns JWT Cookies
 */
export async function processCallback(code, loginIp) {
    const basicAuth = Buffer.from(
        `${process.env.ESI_CLIENT_ID}:${process.env.ESI_CLIENT_SECRET}`
    ).toString("base64");

    let tokenData;
    try {
        const tokenResponse = await axios.post(
            "https://login.eveonline.com/v2/oauth/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.ESI_CALLBACK_URL,
            }),
            {
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        tokenData = tokenResponse.data;
    } catch (err) {
        const msg = err.response?.data || err.message;
        throw new Error(`토큰 요청 실패: ${JSON.stringify(msg)}`);
    }

    const { access_token, refresh_token, expires_in } = tokenData;

    try {
        const character = await getCharacterInfo(access_token); //캐릭터 종합 정보

        const characterRole = await getCharacterRole(character.CharacterID, access_token); //캐릭터의 코퍼레이션 롤
        const extractRole = extractTags(characterRole); //색상코드 같은 불필요한 값 제거
        const corpId = await getCharacterCorpId(character.CharacterID); //캐릭터의 코퍼레이션 ID 가져오기
        if (!isAllowedCorp(corpId)) {
            throw new Error(
                `허용되지 않은 코퍼레이션 유저가 로그인 시도: ${character.CharacterName} : ${character.CharacterID}`
            );
        }

        const now = new Date();

        await prisma.users.upsert({
            where: { character_id: character.CharacterID },
            update: {
                nickname: character.CharacterName,
                corp: corpId,
                refresh_token,
                access_expires_at: new Date(Date.now() + expires_in * 1000),
                last_login_at: now,
                last_login_ip: loginIp,
                scopes: character.Scopes,
                Role: extractRole,
            },
            create: {
                character_id: character.CharacterID,
                nickname: character.CharacterName,
                corp: corpId,
                refresh_token,
                access_expires_at: new Date(Date.now() + expires_in * 1000),
                last_login_at: now,
                last_login_ip: loginIp,
                scopes: character.Scopes,
                Role: extractRole,
            },
        });

        const token = createJwt(character.CharacterID, character.CharacterName, extractRole);

        logger().info("DB에 유저 정보 저장/업데이트 완료", { 닉네임: character.CharacterName });
        return token;
    } catch (err) {
        const msg = err.response?.data || err.message;
        throw new Error(`${JSON.stringify(msg)}`);
    }
}
