/**
 * 요청 객체에서 유저 정보를 문자열로 반환
 *
 * @param {import("express").Request} req - Express 요청 객체
 * @returns {string} 유저 정보 문자열
 * @throws {Error} 유저 정보가 없거나 필드가 누락된 경우
 */
export default function printUserInfo(req) {
    const user = req.user;
    if (!user) {
        throw new Error('유저 정보 없음');
    }

    if (!user.nickName) {
        throw new Error('유저 닉네임 누락');
    }
    if (!user.roles) {
        throw new Error('유저 권한 누락');
    }
    if (!user.characterId) {
        throw new Error('유저 캐릭터ID 누락');
    }

    const roles = Array.isArray(user.roles) ? user.roles.join(',') : user.roles;

    return `닉네임: ${user.nickName} 권한: ${roles} 캐릭터ID: ${user.characterId}`;
}
