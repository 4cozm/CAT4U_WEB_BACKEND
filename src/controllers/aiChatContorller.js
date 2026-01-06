// src/controllers/aiChatController.js
import { google } from "@ai-sdk/google";
import {
    aiDocumentFormats,
    injectDocumentStateMessages,
    toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";
import { convertToModelMessages, streamText } from "ai";
import { logger } from "../utils/logger.js";

const CUSTOM_INSTRUCTION = `
너는 귀여운 여자 치비 아니메 고양이 "문서 편집자"다옹.
사용자가 요청하면 문서를 고치고/정리하고/다듬고/예쁘게 편집해줘냥.

중요:
- 결과는 반드시 applyDocumentOperations 툴 호출로 "문서 편집" 형태로만 제출해라.
- 일반 텍스트만 출력하고 끝내면 실패다옹.
`.trim();

const TOOL_RULES = `
중요 규칙:
- applyDocumentOperations의 operations는 1개 이상 포함되어야 한다.
- type="update"의 operation.block에는 "단 하나의 최상위 블록 태그"만 포함해야 한다.
  예: "<h1>...</h1>" 또는 "<p>...</p>" 처럼 1개만.
- "<h1>...</h1><p>...</p><ul>...</ul>" 같이 여러 블록 태그를 한 block 문자열에 넣지 마라.
- 여러 블록을 만들려면 operations를 여러 개 만들고,
  첫 블록은 update, 이후 내용은 add operations로 분리해라.
- type="add"의 blocks 배열도 각 원소가 "단 하나의 최상위 블록 태그"만 포함해야 한다.
  blocks에 "<h2>...</h2>\\n<p>...</p>" 같이 여러 블록을 한 문자열로 넣지 마라.
`.trim();

function normalizeBody(reqBody) {
    const body = reqBody ?? {};
    // DefaultChatTransport 래핑 대비
    const messages = body.messages ?? body.data?.messages ?? null;
    const toolDefinitions = body.toolDefinitions ?? body.data?.toolDefinitions ?? null;
    return { messages, toolDefinitions };
}

function safePreview(x, n = 350) {
    if (x === null) {
        return "null";
    }
    if (typeof x === "string") {
        return x.slice(0, n);
    }
    try {
        return JSON.stringify(x).slice(0, n);
    } catch {
        return String(x).slice(0, n);
    }
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

    // 연결이 중간에 끊기는지 관찰
    res.on("close", () => {
        log.info("[aiChat] res close", {
            headersSent: res.headersSent,
            ended: res.writableEnded,
        });
    });

    try {
        const { messages, toolDefinitions } = normalizeBody(req.body);

        log.info("[aiChat] request", {
            messagesLen: Array.isArray(messages) ? messages.length : null,
            toolDefinitionsType: Array.isArray(toolDefinitions) ? "array" : typeof toolDefinitions,
            toolKeys:
                toolDefinitions &&
                typeof toolDefinitions === "object" &&
                !Array.isArray(toolDefinitions)
                    ? Object.keys(toolDefinitions).slice(0, 10)
                    : null,
        });

        if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
            log.warn("[aiChat] missing GOOGLE_GENERATIVE_AI_API_KEY");
            return res.status(500).json({ ok: false, message: "AI API 키가 없다옹.." });
        }

        const modelId = "gemini-2.5-flash";
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
        const toolsKeys = tools && typeof tools === "object" ? Object.keys(tools) : [];

        log.info("[aiChat] tools", {
            modelId,
            toolCount: toolsKeys.length,
            toolKeys: toolsKeys.slice(0, 20),
        });

        const modelMessages = convertToModelMessages(injectDocumentStateMessages(messages));
        log.info("[aiChat] modelMessages", {
            count: Array.isArray(modelMessages) ? modelMessages.length : null,
            firstRole: modelMessages?.[0]?.role,
            lastRole: modelMessages?.[modelMessages.length - 1]?.role,
        });

        const toolChoice = { type: "tool", toolName: "applyDocumentOperations" };

        log.info("[aiChat] config", {
            modelId,
            toolChoice,
            maxRetries: 0,
            toolsKeys: toolsKeys.slice(0, 10),
            messagesLen: Array.isArray(modelMessages) ? modelMessages.length : null,
        });

        const result = await streamText({
            model: google(modelId),
            system,
            messages: modelMessages,
            tools,
            toolChoice,
            maxRetries: 0,

            // ✅ 스트리밍 유지: finish를 기다리거나 재시도하지 않는다.
            onFinish: ev => {
                const tc = Array.isArray(ev?.toolCalls) ? ev.toolCalls[0] : null;
                const rawArgs = tc?.args ?? tc?.arguments ?? tc?.input ?? tc?.params ?? null;

                let argObj = rawArgs;
                if (typeof rawArgs === "string") {
                    try {
                        argObj = JSON.parse(rawArgs);
                    } catch {
                        argObj = rawArgs;
                    }
                }

                const ops = argObj?.operations ?? argObj?.documentOperations ?? argObj?.ops ?? null;

                log.info("[aiChat] onFinish", {
                    finishReason: ev?.finishReason,
                    usage: ev?.usage,
                    toolCallsLen: Array.isArray(ev?.toolCalls) ? ev.toolCalls.length : 0,
                    toolCallName: tc?.toolName ?? tc?.name ?? null,
                    argKeys:
                        argObj && typeof argObj === "object" && !Array.isArray(argObj)
                            ? Object.keys(argObj).slice(0, 20)
                            : null,
                    opsLen: Array.isArray(ops) ? ops.length : null,
                    argPreview: safePreview(argObj),
                });

                // toolCalls가 없으면: 서버는 그대로 끝내고, 프론트에서 "다시 시도" UX로 처리하는 게 안정적
                const toolCallsLen = Array.isArray(ev?.toolCalls) ? ev.toolCalls.length : 0;
                if (toolCallsLen === 0) {
                    log.warn("[aiChat] toolCalls missing (client should retry)", {
                        finishReason: ev?.finishReason,
                    });
                }
            },
        });

        log.info("[aiChat] stream start");

        // ✅ BlockNote DefaultChatTransport가 기대하는 UI stream 응답
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
