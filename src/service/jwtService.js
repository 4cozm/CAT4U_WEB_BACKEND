import jwt from 'jsonwebtoken';

export function createJwt(characterId, nickname, roles, accessToken) {
    try {
        const token = jwt.sign(
            {
                characterId: characterId,
                nickName: nickname,
                roles: roles,
                iat: Date.now(),
                accessToken: accessToken,
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        return token;
    } catch (e) {
        throw new Error(`JWT 발급중 에러 발생 : ${e}`);
    }
}
