import { getSignedCookies } from "@aws-sdk/cloudfront-signer";

export function attachMediaCookies(res) {
    const isDev = process.env.isDev === "true";
    if (isDev) {
        return;
    }

    const seconds = 60 * 60 * 24;
    const cfBase = (process.env.AWS_S3_URL || "").replace(/\/$/, "");
    const url = `${cfBase}/*`;

    const privateKey = (process.env.AWS_CLOUDFRONT_KEY_PEM || "")
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "")
        .trim();

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
