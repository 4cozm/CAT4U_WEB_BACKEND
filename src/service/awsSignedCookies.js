import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

export function attachMediaCookies(res) {
    // JWT 검증 통과한 사용자만 여기까지 오게

    const isDev = process.env.isDev === "true";
    if (isDev) {
        return;
    }

    const seconds = 60 * 60 * 24; // JWT랑 동일하게
    const cfBase = (process.env.AWS_S3_URL || "").replace(/\/$/, "");
    const url = `${cfBase}/*`;
    const privateKey = (process.env.AWS_CLOUDFRONT_KEY_PEM || "").replace(/\\n/g, "\n"); //전처리
    console.log("비밀키", privateKey);
    const cookies = getSignedCookies({
        url,
        keyPairId: process.env.AWS_CLOUDFRONT_PUBLIC_KEY_ID, // CloudFront Public Key ID
        privateKey: privateKey, // private key PEM 문자열
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
    console.log("내부 쿠키 값", cookies);
    res.append("Set-Cookie", `CloudFront-Policy=${cookies["CloudFront-Policy"]}; ${common}`);
    res.append("Set-Cookie", `CloudFront-Signature=${cookies["CloudFront-Signature"]}; ${common}`);
    res.append(
        "Set-Cookie",
        `CloudFront-Key-Pair-Id=${cookies["CloudFront-Key-Pair-Id"]}; ${common}`
    );
}
