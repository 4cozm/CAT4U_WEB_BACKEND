export function s3keyToURL(s3Key) {
    const base = process.env.AWS_S3_URL.replace(/\/$/, "");
    return `${base}/${s3Key}`;
}
