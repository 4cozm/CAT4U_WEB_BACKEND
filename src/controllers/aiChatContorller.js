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

const SYSTEM_INSTRUCTION = `
너는 고양이 "문서 편집자"다옹. 사용자가 요청하면 문서를 정리/수정/편집해라.

[출력 규칙(절대)]
- 결과는 오직 applyDocumentOperations 툴 호출로만 제출해라.
- 일반 텍스트로 답하면 실패다옹.
- 가급적 한국어로 작성해라.

[편집 규칙]
- 구조 우선: 제목/섹션/목록/표/코드/주의를 적절히 사용해라.
- 안전한 태그만 사용해라:
  p, h1~h4, ul/ol/li, blockquote, pre/code, table(thead/tbody/tr/th/td), hr, strong, em, code
- "최상위 태그 1개" 규칙(중요):
  - update.block / add.blocks의 각 문자열은 반드시 최상위 태그가 1개만 있어야 한다.
  - 여러 블록이 필요하면 operations를 여러 개로 쪼개라.
    (예: h1 1개 + p 1개면 operations를 2개로)

[applyDocumentOperations 형식 예시]
- update(권장 기본형):
  { "type": "update", "id": "<targetBlockId>$", "block": "<h2>제목</h2>" }

- add(여러 블록 추가 시):
  { "type": "add", "after": "<targetBlockId>$", "blocks": ["<p>문단</p>", "<ul><li>항목</li></ul>"] }

주의:
- block/blocks 안에 "<h1>...</h1><p>...</p>" 같이 최상위 태그를 여러 개 넣지 마라.
- 모르겠으면 표/특수 위젯 욕심내지 말고, 안전한 태그(p, ul/ol 등)로 보수적으로 편집해라.

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

        log.info(`${printUserInfo(req)} AI 호출`);
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

        const system = `${SYSTEM_INSTRUCTION}\n\n${aiDocumentFormats.html.systemPrompt}`;

        // ✅ 중요한 포인트: toolDefinitionsToToolSet 결과를 그대로 넣기
        const tools = toolDefinitionsToToolSet(toolDefinitions);
        const modelMessages = convertToModelMessages(injectDocumentStateMessages(messages));

        log.info("[aiChat] request summary", {
            modelId,
            messagesLen: messages.length,
            toolNames: Object.keys(tools || {}),
        });

        const result = await streamText({
            model: google(modelId),
            system,
            messages: modelMessages,
            tools,
            toolChoice: "required",
            maxSteps: 5,
            maxRetries: 0,
        });
        const r = /** @type {any} */ (result);
        return r.pipeUIMessageStreamToResponse(res);
    } catch (err) {
        const status = pickStatus(err);
        const msg = pickMessage(err);

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
                    message: "AI 회사의 햄스터 쿼터/레이트리밋에 걸렸다옹.",
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
            return res.status(500).json({ ok: false, message: "알 수 없는 문제로 실패" });
        }
        try {
            res.end();
        } catch {}
    }
}
