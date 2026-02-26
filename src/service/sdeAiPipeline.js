import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildSdeFunctionDeclarations, executeSdeTool } from "./sdeSkills.js";

/**
 * SDE Update AI Pipeline
 * 패치노트나 사용자 가이드 일부 텍스트를 입력받아, 내부에 언급된 함선/모듈을 파악하고
 * SDE 도구를 직접 호출하여 팩트(수치, 보너스)를 확인합니다.
 * 백그라운드 워커에 적합한 가벼운 1-Pass 아키텍처입니다.
 */
export async function getSdeUpdateFacts(userPrompt) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 가 설정되지 않았습니다.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
    const functionDeclarations = buildSdeFunctionDeclarations();

    const checkerModel = genAI.getGenerativeModel({
        model: modelName,
        tools: [{ functionDeclarations }],
        systemInstruction: {
            role: "system",
            parts: [
                {
                    text:
                        "Role: EVE Online Data Fetcher AI for automated updates.\n" +
                        "Your goal: Extract the names of ships, modules, or skills from the user's prompt, and use tools to fetch their CURRENT SDE STATS.\n" +
                        "Rules:\n" +
                        "1. Use 'get_eve_item_context' to fetch exact numerical data. Use the minimal necessary 'scope' array (e.g., ['traits', 'targeting_profile']).\n" +
                        "2. Use 'search_eve_categories' if asked about categories or lists.\n" +
                        "3. After gathering the data, output a brief text summary of the numerical facts found.\n" +
                        "4. Do NOT hallucinate or guess. Rely ONLY on the data returned by the tools.",
                },
            ],
        },
    });

    console.log("\x1b[36m[SDE Update AI] 팩트체커 가동 중...\x1b[0m");
    const chat = checkerModel.startChat();
    let result = await chat.sendMessage(userPrompt);
    let functionCalls = result.response.functionCalls();

    const rawSdeMemory = [];
    let steps = 0;
    while (functionCalls && steps < 6) {
        const functionResponses = [];
        for (const call of functionCalls) {
            console.log(
                `  \x1b[90m[Step] Tool 호출:\x1b[0m ${call.name} (args: ${JSON.stringify(call.args)})`
            );
            try {
                const apiResponse = await executeSdeTool(call.name, call.args);

                // 프론트엔드용 다국어 맵핑 데이터 제거 (Update AI는 Raw JSON만 필요)
                if (apiResponse && apiResponse.__localization) {
                    delete apiResponse.__localization;
                }

                rawSdeMemory.push({ tool: call.name, args: call.args, result: apiResponse });
                functionResponses.push({
                    functionResponse: { name: call.name, response: apiResponse },
                });
            } catch (err) {
                functionResponses.push({
                    functionResponse: { name: call.name, response: { error: err.message } },
                });
            }
        }

        result = await chat.sendMessage(functionResponses);
        functionCalls = result.response.functionCalls();
        steps++;
    }

    let factCheckedText = "";
    try {
        factCheckedText = result.response.text() || "";
    } catch (_) {}

    console.log("\x1b[32m[SDE Update AI] 완료. 텍스트 요약 결과:\x1b[0m\n", factCheckedText);

    // Update AI(호출부)에서 프로그래밍적으로 활용할 수 있게 Raw SDE Data 배열을 직접 반환
    return { summary: factCheckedText, rawFacts: rawSdeMemory };
}
