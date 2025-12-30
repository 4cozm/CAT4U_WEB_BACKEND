import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

export function attachMediaCookies(res) {
    const isDev = process.env.isDev === "true";
    if (isDev) {
        return;
    }

    const seconds = 60 * 60 * 24;
    const cfBase = (process.env.AWS_S3_URL || "").replace(/\/$/, "");
    const url = `${cfBase}/*`;

    let rawKey = process.env.AWS_CLOUDFRONT_KEY_PEM || "";

    // 1. 혹시 모를 공백이나 따옴표 제거
    rawKey = rawKey.replace(/["']/g, "").trim();

    // 2. 64자마다 줄바꿈을 넣어주는 처리 (PEM 표준 규격)
    const formattedKey = rawKey.match(/.{1,64}/g).join("\n");

    // 3. Header와 Footer를 포함한 완전한 PEM 생성
    const privateKey = [
        "-----BEGIN RSA PRIVATE KEY-----",
        formattedKey,
        "-----END RSA PRIVATE KEY-----",
    ].join("\n");

    const cookies = getSignedCookies({
        url,
        keyPairId: process.env.AWS_CLOUDFRONT_PUBLIC_KEY_ID,
        privateKey,
        dateLessThan: new Date(Date.now() + seconds * 1000),
    });

    const common = [
        "Path=/",
        "Secure",
        "HttpOnly",
        `Max-Age=${seconds}`,
        "SameSite=Lax",
        "Domain=.catalyst-for-you.com",
    ].join("; ");

    for (const [name, value] of Object.entries(cookies)) {
        if (!value) {
            continue;
        }
        res.append("Set-Cookie", `${name}=${value}; ${common}`);
    }
}
