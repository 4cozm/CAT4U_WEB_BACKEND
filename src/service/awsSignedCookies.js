import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

export function attachMediaCookies(res) {
    const isDev = process.env.isDev === "true";
    if (isDev) {
        console.log("[CloudFront] Dev mode: skipping cookie attachment.");
        return;
    }

    const seconds = 60 * 60 * 24;
    const cfBase = (process.env.AWS_S3_URL || "").replace(/\/$/, "");
    const url = `${cfBase}/*`;

    let rawKey = process.env.AWS_CLOUDFRONT_KEY_PEM || "";

    // [체크 1] 환경변수 로드 확인
    if (!rawKey) {
        console.error("[CloudFront] Error: AWS_CLOUDFRONT_KEY_PEM is missing in env.");
    }

    rawKey = rawKey.replace(/["']/g, "").trim();

    const formattedKey = rawKey.match(/.{1,64}/g).join("\n");

    const privateKey = [
        "-----BEGIN PRIVATE KEY-----",
        formattedKey,
        "-----END PRIVATE KEY-----",
    ].join("\n");

    // [체크 2] 최종 조립된 키 형식 확인 (처음 20자만 출력해서 보안 유지)
    console.log("[CloudFront] Formatted Key Preview:", privateKey.substring(0, 40) + "...");

    try {
        const cookies = getSignedCookies({
            url,
            keyPairId: process.env.AWS_CLOUDFRONT_PUBLIC_KEY_ID,
            privateKey,
            dateLessThan: new Date(Date.now() + seconds * 1000),
        });

        // [체크 3] 쿠키 생성 결과 확인
        const cookieNames = Object.keys(cookies);
        console.log("[CloudFront] Successfully generated cookies:", cookieNames);

        if (cookieNames.length === 0) {
            console.warn(
                "[CloudFront] Warning: No cookies were generated. Check KeyPairId or URL."
            );
        }

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
                console.warn(`[CloudFront] Skip empty cookie value for: ${name}`);
                continue;
            }
            res.append("Set-Cookie", `${name}=${value}; ${common}`);
        }
    } catch (err) {
        // [체크 4] 서명 단계 에러 캡처
        console.error("[CloudFront] Critical Error during signing:");
        console.error("- Message:", err.message);
        console.error("- Stack:", err.stack);
        // OpenSSL 관련 에러 상세 정보 출력
        if (err.opensslErrorStack) {
            console.error("- OpenSSL Stack:", JSON.stringify(err.opensslErrorStack));
        }
    }
}
