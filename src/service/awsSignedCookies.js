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
    rawKey = rawKey.replace(/["']/g, "").trim();
    const formattedKey = rawKey.match(/.{1,64}/g).join("\n");
    const privateKey = [
        "-----BEGIN PRIVATE KEY-----",
        formattedKey,
        "-----END PRIVATE KEY-----",
    ].join("\n");

    const policy = JSON.stringify({
        Statement: [
            {
                Resource: url,
                Condition: {
                    DateLessThan: {
                        "AWS:EpochTime": Math.floor((Date.now() + seconds * 1000) / 1000),
                    },
                },
            },
        ],
    });

    try {
        const cookies = getSignedCookies({
            policy,
            keyPairId: process.env.AWS_CLOUDFRONT_PUBLIC_KEY_ID,
            privateKey,
        });

        console.log("[CloudFront] Generated Custom Policy Cookies:", Object.keys(cookies));

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
    } catch (err) {
        console.error("[CloudFront] Signing Error:", err.message);
    }
}
