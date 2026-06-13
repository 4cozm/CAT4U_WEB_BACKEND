import axios from "axios";
import * as cheerio from "cheerio";
import cron from "node-cron";
import { getPrisma } from "../service/prismaService.js";
import { logger } from "../utils/logger.js";

const EVE_NEWS_URL = "https://www.eveonline.com/news";
const EVE_BASE_URL = "https://www.eveonline.com";

/**
 * 1. Hub Detection (Major Version)
 * EVE Online News 페이지에서 가장 최신의 "Patch Notes" 카테고리 링크를 찾습니다.
 */
async function fetchLatestPatchNoteHubUrl() {
    try {
        const { data } = await axios.get(EVE_NEWS_URL, {
            headers: { "Accept-Language": "en-US,en;q=0.9" },
        });

        // 정규식을 활용하여 사이드바의 PatchNotesLatest 컨테이너 내 최신 패치노트 URL 추출
        const hubMatch = data.match(
            /class=["']PatchNotesLatest_patchNotes__[a-zA-Z0-9]+["'][^>]*>\s*<a\s+[^>]*href=["'](\/[a-z]{0,2}\/?news\/view\/patch-notes-[^"']+)["']/i
        );
        if (hubMatch && hubMatch[1]) {
            const latestHubPath = hubMatch[1];
            return latestHubPath.startsWith("http")
                ? latestHubPath
                : `${EVE_BASE_URL}${latestHubPath}`;
        }

        // Fallback: 일반적인 a 태그 확인
        const $ = cheerio.load(data);
        const patchNoteLink = $("a")
            .toArray()
            .map(el => $(el).attr("href"))
            .filter(href => href && href.includes("/news/view/patch-notes-"));

        if (patchNoteLink.length > 0) {
            const latestHubPath = patchNoteLink[0];
            return latestHubPath.startsWith("http")
                ? latestHubPath
                : `${EVE_BASE_URL}${latestHubPath}`;
        }

        return null;
    } catch (err) {
        logger().error(`[Patch Crawler] 허브 페이지 접근 실패: ${err.message}`);
        return null;
    }
}

/**
 * 2. Delta Extraction (Incremental)
 * 특정 패치노트 페이지에서 마지막 앵커 이후의 새로운 텍스트들을 섹션 단위로 추출합니다.
 */
async function extractPatchNoteDelta(url, lastAnchor) {
    try {
        const { data } = await axios.get(url, {
            headers: { "Accept-Language": "en-US,en;q=0.9" },
        });

        const apolloMatch = data.match(/window\.APOLLO_STATE=(.+?)<\/script/);
        if (!apolloMatch) {
            return { sections: [], newAnchor: lastAnchor };
        }

        const apolloState = JSON.parse(apolloMatch[1]);
        const root = apolloState.ROOT_QUERY;
        if (!root) {
            return { sections: [], newAnchor: lastAnchor };
        }

        let patchContentNodes = null;
        for (const key in root) {
            if (key.startsWith("articleCollection(") && root[key].items) {
                for (const item of root[key].items) {
                    if (item.slug && item.slug.includes("patch-notes") && item.richText) {
                        patchContentNodes = item.richText.json.content;
                        break;
                    }
                }
            }
            if (patchContentNodes) {
                break;
            }
        }

        if (!patchContentNodes) {
            return { sections: [], newAnchor: lastAnchor };
        }

        function extractText(node) {
            if (node.nodeType === "text") {
                return node.value;
            }
            if (!node.content) {
                return "";
            }
            return node.content.map(extractText).join("");
        }

        const sections = [];
        let currentSectionTitle = "";
        let currentSectionContent = "";
        let newAnchor = lastAnchor;
        let isFirstHeader = true;

        for (const node of patchContentNodes) {
            const nodeType = node.nodeType || "";
            const rawText = extractText(node).trim();

            // EVE 뉴스에서 패치 날짜 타이틀은 주로 heading-2 이거나 "Patch Notes for" 형태로 시작합니다.
            const isMajorHeader = nodeType === "heading-2" || /^Patch\s*Notes\s*for/i.test(rawText);
            const isSubHeader = nodeType.startsWith("heading") && !isMajorHeader;

            // 이전에 읽었던 앵커를 만나면 종료 (Idempotent)
            if (lastAnchor && rawText === lastAnchor) {
                break;
            }

            if (isMajorHeader) {
                // 새로운 메이저 헤더(날짜 섹션)를 만나면, 이전 섹션을 배열에 푸시하고 초기화
                if (currentSectionTitle !== "" && currentSectionContent.trim() !== "") {
                    const dateMatch = currentSectionTitle.match(/(\d{4}-\d{2}-\d{2})/);
                    sections.push({
                        title: currentSectionTitle,
                        patch_date: dateMatch ? dateMatch[1] : null,
                        content: currentSectionContent.trim(),
                    });
                }
                currentSectionTitle = rawText;
                currentSectionContent = "";

                if (isFirstHeader && rawText) {
                    newAnchor = rawText;
                    isFirstHeader = false;
                }
                continue;
            }

            // 아직 어떤 패치노트 헤더도 만나지 않았다면(페이지 최상단의 쓰레기 텍스트 등) 무시합니다.
            if (currentSectionTitle === "") {
                continue;
            }

            if (!rawText && nodeType !== "hr") {
                continue;
            }

            if (isSubHeader) {
                currentSectionContent += `\n\n### ${rawText}\n`;
            } else if (nodeType === "unordered-list" || nodeType === "ordered-list") {
                for (const itemNode of node.content || []) {
                    const itemText = extractText(itemNode).replace(/\n/g, " ").trim();
                    if (itemText) {
                        currentSectionContent += `- ${itemText}\n`;
                    }
                }
            } else if (nodeType === "hr") {
                currentSectionContent += `\n---\n`;
            } else if (rawText) {
                currentSectionContent += `${rawText}\n`;
            }
        }

        if (currentSectionTitle !== "" && currentSectionContent.trim() !== "") {
            const dateMatch = currentSectionTitle.match(/(\d{4}-\d{2}-\d{2})/);
            sections.push({
                title: currentSectionTitle,
                patch_date: dateMatch ? dateMatch[1] : null,
                content: currentSectionContent.trim(),
            });
        }

        if (isFirstHeader && sections.length > 0) {
            newAnchor = sections[0].title;
        }

        return { sections, newAnchor };
    } catch (err) {
        logger().error(`[Patch Crawler] 패치노트 파싱 실패 (${url}): ${err.message}`);
        return { sections: [], newAnchor: lastAnchor };
    }
}

/**
 * 3. 통합 실행 루틴
 */
export async function runPatchNoteCrawler() {
    const log = logger();
    log.info("[Patch Crawler] 패치노트 추적 시작...");

    const prisma = getPrisma();
    if (!prisma) {
        log.error("[Patch Crawler] 데이터베이스 클라이언트를 불러오지 못했습니다.");
        return;
    }

    const latestUrl = await fetchLatestPatchNoteHubUrl();
    if (!latestUrl) {
        log.warn("[Patch Crawler] 최신 패치노트 허브를 찾을 수 없습니다.");
        return;
    }

    const parsedUrl = new URL(latestUrl);
    const hubId = parsedUrl.pathname.split("/").pop();

    try {
        const existingHub = await prisma.patchNoteHub.findUnique({
            where: { id: hubId },
        });

        const isNewMajorVersion = !existingHub;

        if (isNewMajorVersion) {
            log.info(`[Patch Crawler] 새로운 메이저 버전 감지 (New Hub Detected) - ID: ${hubId}`);
        } else {
            log.info(`[Patch Crawler] 동일 메이저 버전 유지 (Same Hub) - ID: ${hubId}`);
        }

        const lastAnchor = isNewMajorVersion ? null : existingHub.last_anchor;
        const { sections, newAnchor } = await extractPatchNoteDelta(latestUrl, lastAnchor);

        if (!sections || sections.length === 0) {
            log.info(
                "[Patch Crawler] 추가된 새로운 델타(Delta) 텍스트가 없습니다. (멱등성 유지, 종료)"
            );
            return;
        }

        log.info(
            `[Patch Crawler] 델타 분리 성공 (추출된 섹션 수: ${sections.length}). DB 저장 시작.`
        );

        await prisma.patchNoteHub.upsert({
            where: { id: hubId },
            update: { last_anchor: newAnchor },
            create: { id: hubId, last_anchor: newAnchor },
        });

        for (const section of sections) {
            const sectionHash = (hubId + "__" + section.title).substring(0, 200);

            await prisma.patchNote.upsert({
                where: { id: sectionHash },
                update: {
                    content: section.content,
                },
                create: {
                    id: sectionHash,
                    hub_id: hubId,
                    title: section.title,
                    patch_date: section.patch_date,
                    content: section.content,
                    published_at: new Date(),
                },
            });
        }

        log.info("[Patch Crawler] 패치노트 섹션별 저장 완료.");
    } catch (err) {
        log.error(`[Patch Crawler] 데이터베이스 작업 실패: ${err.message}`);
    }
}

/**
 * 서버 시작 시 CRON 등록용
 */
export function registerPatchCrawlerJob() {
    console.log("\x1b[32m✔\x1b[0m 패치노트 추적(Hub-Sentinel) CRON 등록 완료");

    // 매일 자정, 정오, 오후 6시에 실행
    cron.schedule(
        "0 0,12,18 * * *",
        async () => {
            await runPatchNoteCrawler();
        },
        { timezone: "Asia/Seoul" }
    );
}
