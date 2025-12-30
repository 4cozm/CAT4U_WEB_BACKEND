/** 파일 참조(ref_count) 증감 + 읽기 시 최적화 URL 치환 유틸 */
import path from "node:path";
import { URL } from "node:url";
import { s3keyToURL } from "../utils/s3keyToURL.js";

/**
 * board_content 입력을 "블록 배열" 형태로 정규화한다.
 *
 * - 이미 배열이면 그대로 반환한다.
 * - 문자열이면 JSON.parse를 시도해 배열이면 반환한다.
 * - 그 외(파싱 실패, null/undefined, 객체 등)는 빈 배열을 반환한다.
 *
 * @param {any} boardContent BlockNote 저장 데이터. 블록 배열 또는 JSON 문자열.
 * @returns {Array} BlockNote 블록 배열. 실패 시 [].
 */
function normalizeBlocks(boardContent) {
    if (!boardContent) {
        return [];
    }
    if (Array.isArray(boardContent)) {
        return boardContent;
    }

    if (typeof boardContent === "string") {
        try {
            const parsed = JSON.parse(boardContent);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

/**
 * URL이 우리 S3 prefix에 해당하는지 확인한 뒤,
 * URL의 pathname에서 파일명(basename)을 뽑고 확장자를 제거해 md5를 추출한다.
 *
 * - prefix로 시작하지 않으면 null
 * - URL 파싱에 실패하면 null
 * - basename에서 확장자를 제거한 값이 32자리 hex가 아니면 null
 *
 * @param {string} url BlockNote 블록의 props.url 값.
 * @param {string} s3Prefix 우리 S3 URL prefix.
 * @returns {string|null} md5(소문자) 또는 null.
 */
function tryExtractMd5FromUrl(url, s3Prefix) {
    if (!url || typeof url !== "string") {
        return null;
    }
    if (!s3Prefix || typeof s3Prefix !== "string") {
        return null;
    }
    if (!url.startsWith(s3Prefix)) {
        return null;
    }

    let u;
    try {
        u = new URL(url);
    } catch {
        return null;
    }

    const base = path.posix.basename(u.pathname);
    const ext = path.posix.extname(base);
    const name = ext ? base.slice(0, -ext.length) : base;

    if (!/^[a-f0-9]{32}$/i.test(name)) {
        return null;
    }
    return name.toLowerCase();
}

/**
 * BlockNote 블록 배열을 재귀 순회하며 image/video의 md5를 Set으로 수집한다.
 * 이 함수는 "블록 배열"을 받는다. (normalizeBlocks는 호출자가 1회만 수행)
 *
 * @param {Array} blocks BlockNote 블록 배열
 * @param {string} s3Prefix 우리 S3 URL prefix
 * @returns {Set<string>} md5 Set
 */
function collectMd5SetFromBlocks(blocks, s3Prefix) {
    const out = new Set();

    function walk(list) {
        if (!Array.isArray(list)) {
            return;
        }

        for (const b of list) {
            if (!b || typeof b !== "object") {
                continue;
            }

            if (b.type === "image" || b.type === "video") {
                const url = b.props?.url;
                const md5 = tryExtractMd5FromUrl(url, s3Prefix);
                if (md5) {
                    out.add(md5);
                }
            }

            if (Array.isArray(b.children) && b.children.length) {
                walk(b.children);
            }
        }
    }

    walk(blocks);
    return out;
}

/**
 * 저장/수정 공용: file.ref_count 증감 처리
 *
 * - create: prevContent 없이 호출하면 "next에 존재하는 md5 전부 +1"
 * - update: prevContent를 넘기면 prev/next diff로 +1/-1
 *
 * @param {object} tx Prisma transaction client
 * @param {any} nextContent 수정/저장 후 board_content (배열 또는 JSON 문자열)
 * @param {object} opts
 * @param {any} [opts.prevContent] 수정 전 board_content (배열 또는 JSON 문자열)
 * @param {string} [opts.s3Prefix] 기본: process.env.AWS_S3_URL
 * @returns {Promise<{added: string[], removed: string[]}>}
 */
export async function applyFileRefCountDelta(tx, nextContent, opts = {}) {
    const s3Prefix = (opts.s3Prefix ?? process.env.AWS_S3_URL ?? "").replace(/\/$/, "");
    const nextBlocks = normalizeBlocks(nextContent);
    const prevBlocks = opts.prevContent !== null ? normalizeBlocks(opts.prevContent) : [];

    const nextSet = collectMd5SetFromBlocks(nextBlocks, s3Prefix);
    const prevSet =
        opts.prevContent !== null ? collectMd5SetFromBlocks(prevBlocks, s3Prefix) : new Set();

    const added = [];
    for (const md5 of nextSet) {
        if (!prevSet.has(md5)) {
            added.push(md5);
        }
    }

    const removed = [];
    for (const md5 of prevSet) {
        if (!nextSet.has(md5)) {
            removed.push(md5);
        }
    }

    if (added.length) {
        await tx.file.updateMany({
            where: { file_md5: { in: added } },
            data: { ref_count: { increment: 1 } },
        });
    }

    if (removed.length) {
        await tx.file.updateMany({
            where: { file_md5: { in: removed } },
            data: { ref_count: { decrement: 1 } },
        });
        await tx.$executeRaw`UPDATE file SET ref_count = 0 WHERE ref_count < 0`;
    }

    return { added, removed };
}

/**
 * (READ) 게시글 content에서 image/video URL을 최적화 상태에 따라 치환한다.
 *
 * 1) JSON 파싱 1회 (normalizeBlocks)
 * 2) md5 추출 1회 순회 (collectMd5SetFromBlocks)
 * 3) DB 조회 1회 (md5 IN)
 * 4) optimized인 것만 url 치환 후 반환
 *
 *
 * @param {object} tx Prisma transaction client (또는 prisma)
 * @param {any} boardContent BlockNote content (배열 또는 JSON 문자열)
 * @param {object} opts
 * @param {string} [opts.s3Prefix] 기본: process.env.AWS_S3_URL
 * @returns {Promise<Array>} 치환된 블록 배열
 */
export async function resolveOptimizedMediaUrls(tx, boardContent, opts = {}) {
    const s3Prefix = (opts.s3Prefix ?? process.env.AWS_S3_URL ?? "").replace(/\/$/, "");
    const blocks = normalizeBlocks(boardContent);

    const md5Set = collectMd5SetFromBlocks(blocks, s3Prefix);
    const md5s = [...md5Set];
    if (md5s.length === 0) {
        return blocks;
    }

    const rows = await tx.file.findMany({
        where: { file_md5: { in: md5s } },
        select: { file_md5: true, status: true, s3_key: true },
    });

    const urlMap = new Map();
    for (const r of rows) {
        if (r.status !== "optimized") {
            continue;
        }
        if (!r.s3_key) {
            continue;
        }
        urlMap.set(String(r.file_md5).toLowerCase(), s3keyToURL(r.s3_key));
    }
    if (urlMap.size === 0) {
        return blocks;
    }

    return mapMediaUrls(blocks, url => {
        const md5 = tryExtractMd5FromUrl(url, s3Prefix);
        return md5 ? (urlMap.get(md5) ?? url) : url;
    });
}

/**
 * BlockNote 블록 배열을 재귀 순회하며 image/video 블록의 props.url을 mapFn으로 치환한다.
 *
 * @param {Array} blocks BlockNote 블록 배열
 * @param {(url: string) => string} mapFn url 변환 함수
 * @returns {Array} 새 블록 배열 (불변 업데이트)
 */
function mapMediaUrls(blocks, mapFn) {
    function walk(list) {
        if (!Array.isArray(list)) {
            return list;
        }

        return list.map(b => {
            if (!b || typeof b !== "object") {
                return b;
            }

            const next = { ...b };

            if ((next.type === "image" || next.type === "video") && next.props?.url) {
                next.props = { ...next.props, url: mapFn(next.props.url) };
            }

            if (Array.isArray(next.children) && next.children.length) {
                next.children = walk(next.children);
            }

            return next;
        });
    }

    return walk(blocks);
}
