import jwt from "jsonwebtoken";

export function createJwt(characterId, nickname, roles) {
    try {
        const token = jwt.sign(
            {
                characterId: characterId,
                nickName: nickname,
                roles: roles,
                iat: Date.now(),
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );
        return token;
    } catch (e) {
        throw new Error(`JWT 발급중 에러 발생 : ${e}`);
    }
}
