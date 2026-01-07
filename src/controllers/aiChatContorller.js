// src/controllers/aiChatController.js
import { google } from "@ai-sdk/google";
import {
    aiDocumentFormats,
    injectDocumentStateMessages,
    toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";
import { convertToModelMessages, streamText } from "ai";
import { logger } from "../utils/logger.js";
import printUserInfo from "../utils/printUserInfo.js";

const CUSTOM_INSTRUCTION = `
너는 귀여운 여자 치비 아니메 고양이 "문서 편집자"다옹.
사용자가 요청하면 문서를 고치고/정리하고/다듬고/예쁘게 편집해줘냥.

출력 규칙(절대):
- 결과는 반드시 applyDocumentOperations 툴 호출로만 제출해라.
- 일반 텍스트만 출력하면 실패다옹.

편집 원칙(중요):
- 문서 성격에 맞게 블록을 다양하게 써서 "구조"를 잡아라냥. (p만 남발하지 마라냥)
- 최상위 블록 태그는 1개만 지키되, 그 안의 중첩 태그(예: ul 안의 li, table 안의 tr/td)는 여러 개 사용해도 된다옹.
- 확실히 안전한 태그 위주로 사용하고, 확신이 없는 기능(특수 위젯/커스텀 블록)은 무리하지 말고 일반 블록으로 표현해라냥.

구조화 우선 규칙(자동 적용):
- 제목/섹션 구분 → h1/h2/h3
- 절차/단계/순서 → ol + li
- 나열/목록/체크포인트 → ul + li
- 코드/명령어/설정값 → pre + code
- 비교/대조/정리표 → table
- 주의/경고/인용 → blockquote
- 문단 설명 → p
- 문서 구획 나눔 → hr
`.trim();

const TOOL_RULES = `
중요 규칙(절대):
- applyDocumentOperations의 operations는 1개 이상 포함되어야 한다.
- type="update"의 operation.block에는 "단 하나의 최상위 블록 태그"만 포함해야 한다.
  예: "<h1>...</h1>" 또는 "<p>...</p>" 또는 "<ul>...</ul>" 처럼 최상위는 1개만.
- 여러 블록을 만들려면 operations를 여러 개로 쪼개라.
  (첫 블록은 update, 이후 내용은 add operations로 분리하는 걸 권장한다.)
- type="add"의 blocks 배열도 각 원소가 "단 하나의 최상위 블록 태그"만 포함해야 한다.
  blocks에 "<h2>...</h2><p>...</p>" 같이 여러 최상위 블록을 한 문자열로 넣지 마라.

허용(권장) 최상위 태그 목록:
- p, h1, h2, h3, h4
- ul, ol (자식: li)
- blockquote (자식: p 등)
- pre (자식: code)
- table (자식: thead/tbody/tr/th/td)
- hr
- figure (자식: img, figcaption)  ※ 불안하면 figure/img는 쓰지 말고 링크/텍스트로 대체

추가 안전 규칙:
- 최상위 태그 1개 규칙만 지키면, 내부 중첩(예: ul>li 여러 개, table 구조)은 자유롭게 작성 가능.
- 스타일은 과하지 않게: 강조는 <strong>, <em>, <code> 정도만 사용.
- 내용이 길면 "섹션(h2) → 목록/표 → 상세 p" 순으로 정리해라.
`.trim();

function normalizeBody(reqBody) {
    const body = reqBody ?? {};
    // DefaultChatTransport 래핑 대비
    const messages = body.messages ?? body.data?.messages ?? null;
    const toolDefinitions = body.toolDefinitions ?? body.data?.toolDefinitions ?? null;
    return { messages, toolDefinitions };
}

function pickStatus(err) {
    return (
        err?.statusCode ||
        err?.lastError?.statusCode ||
        err?.cause?.statusCode ||
        err?.errors?.[0]?.statusCode ||
        null
    );
}
function pickMessage(err) {
    return err?.message || err?.lastError?.message || err?.errors?.[0]?.message || "unknown error";
}

export async function aiChat(req, res) {
    const log = logger();

    try {
        const { messages, toolDefinitions } = normalizeBody(req.body);

        log.info(`${printUserInfo()} AI 호출`);
        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            log.warn("[aiChat] missing GOOGLE_GENERATIVE_AI_API_KEY");
            return res.status(500).json({ ok: false, message: "AI API 키가 없다옹.." });
        }

        const modelId = process.env.GEMINI_MODEL;
        if (!modelId) {
            log.warn("[aiChat] missing GEMINI_MODEL");
            return res.status(500).json({ ok: false, message: "GEMINI_MODEL 환경변수가 없다옹" });
        }

        if (!Array.isArray(messages)) {
            log.warn("[aiChat] invalid messages (not array)");
            return res.status(400).json({ ok: false, message: "messages는 배열이어야 한다옹" });
        }

        if (!toolDefinitions) {
            log.warn("[aiChat] missing toolDefinitions");
            return res.status(400).json({ ok: false, message: "toolDefinitions가 없다옹" });
        }

        const system = `${CUSTOM_INSTRUCTION}\n\n${TOOL_RULES}\n\n${aiDocumentFormats.html.systemPrompt}`;

        const tools = toolDefinitionsToToolSet(toolDefinitions);
        const modelMessages = convertToModelMessages(injectDocumentStateMessages(messages));
        const toolChoice = { type: "tool", toolName: "applyDocumentOperations" };

        const result = await streamText({
            model: google(modelId),
            system,
            messages: modelMessages,
            tools,
            toolChoice,
            maxRetries: 0,
        });
        const r = /** @type {any} */ (result);
        return r.pipeUIMessageStreamToResponse(res);
    } catch (err) {
        const status = pickStatus(err);
        const msg = pickMessage(err);

        // 429 (quota/rate limit)만 별도 안내
        const isQuota =
            status === 429 ||
            msg.includes("Quota exceeded") ||
            msg.includes("RESOURCE_EXHAUSTED") ||
            msg.includes("rate limit");

        if (isQuota) {
            log.warn("[aiChat] quota/ratelimit", { status: status ?? 429, message: msg });
            if (!res.headersSent) {
                return res.status(429).json({
                    ok: false,
                    code: "AI_QUOTA_EXCEEDED",
                    message:
                        "Gemini API 쿼터/레이트리밋에 걸렸다옹. 사용량 확인 후 다시 시도하거나 결제를 연결해야 한다냥!",
                });
            }
            try {
                res.end();
            } catch {}
            return;
        }

        log.warn("[aiChat] error", {
            status,
            name: err?.name,
            message: msg,
            stack: err?.stack,
        });

        if (!res.headersSent) {
            return res.status(500).json({ ok: false, message: "AI chat failed" });
        }
        try {
            res.end();
        } catch {}
    }
}
