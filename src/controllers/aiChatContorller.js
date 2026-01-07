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
너는 "문서 편집자"다옹. 사용자가 요청하면 문서를 정리/수정/편집해라.

[출력 규칙(절대)]
- 결과는 오직 applyDocumentOperations 툴 호출로만 제출.
- 일반 텍스트로 답하면 실패.

[편집 기본]
- 문서는 "구조"가 우선: 제목/섹션/목록/표/코드/주의를 적절히 사용.
- 안전한 HTML 태그만 사용: p,h1~h4,ul/ol/li,blockquote,pre/code,table(thead/tbody/tr/th/td),hr,strong,em,code.
- 확신 없는 특수 위젯/커스텀 블록은 쓰지 말고 일반 블록으로 표현.

[툴 페이로드 규칙]
- applyDocumentOperations.operations는 1개 이상.
- update.block / add.blocks의 각 문자열은 "최상위 태그 1개"만 허용.
  (여러 블록이 필요하면 operations를 여러 개로 나눠라)

[EVE 정보 출처]
EVE 관련 질문 중 정확성/수치/패치/메커니즘/데이터가 중요하면 (가능하면 googleSearch로) 아래 우선순위로 확인:
- 정확한 사실/메커니즘: Fuzzworks → EVE University Wiki
- 반응/메타/여론: DCInside EVE 갤 → r/Eve
- 데이터 레퍼런스: EVE Ref
상충 시 출처 차이를 짧게 언급하고 보수적으로 요약. 불확실하면 확인 질문 1개만.
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

        if (!Array.isArray(messages)) {
            log.warn("[aiChat] invalid messages (not array)");
            return res.status(400).json({ ok: false, message: "messages는 배열이어야 한다옹" });
        }

        if (!toolDefinitions) {
            log.warn("[aiChat] missing toolDefinitions");
            return res.status(400).json({ ok: false, message: "toolDefinitions가 없다옹" });
        }

        const system = `${SYSTEM_INSTRUCTION}\n\n${aiDocumentFormats.html.systemPrompt}`;

        const tools = toolDefinitionsToToolSet(toolDefinitions);
        const modelMessages = convertToModelMessages(injectDocumentStateMessages(messages));

        const result = await streamText({
            model: google(modelId, {
                googleSearchRetrieval: {},
            }),
            system,
            messages: modelMessages,
            tools: {
                ...tools,
            },
            maxSteps: 5,
            toolChoice: "auto",
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
