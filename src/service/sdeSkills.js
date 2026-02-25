/**
 * @file sdeSkills.js
 * @description EVE Online SDE 기반 AI Function Calling 레이어.
 *
 * 두 가지를 이 파일에서 제공합니다:
 *  1. `SDE_TOOLS`        — AI 모델(프롬프트)에 주입할 JSON Schema 도구 정의 배열
 *  2. `executeSdeTool()` — AI가 도구를 호출할 때 실행되는 SQL 실행기
 *
 * ─────────────────────────────────────────────────────────────
 *  Skill A: translate_and_find_type
 *    영문 아이템/함선명 → 한국어 공식 명칭 + typeID 반환
 *
 *  Skill B: get_item_attributes
 *    typeID → 아이템 세부 스펙(피팅치, Mass 등) JSON 반환
 * ─────────────────────────────────────────────────────────────
 */

import { getDb } from "./sdeService.js";

// ═══════════════════════════════════════════════════════════
//  Part 1: JSON Schema 도구 정의 (AI 프롬프트에 주입)
// ═══════════════════════════════════════════════════════════

/**
 * AI 모델의 `tools` 파라미터에 전달할 Function Calling 스키마 배열.
 *
 * @type {Array<{type: 'function', function: object}>}
 *
 * @example
 * // Vercel AI SDK / Google Gemini 사용 예시
 * import { SDE_TOOLS } from './service/sdeSkills.js';
 *
 * const result = await generateText({
 *   model: google('gemini-2.0-flash'),
 *   tools: buildSdeToolsForAiSdk(),   // AI SDK 포맷으로 변환된 버전 사용 권장
 *   prompt: '리프터 함선의 한국어 명칭과 CPU 스펙을 알려줘',
 * });
 */
export const SDE_TOOLS = [
    // ── Skill A ─────────────────────────────────────────────
    {
        type: "function",
        function: {
            name: "translate_and_find_type",
            description:
                "EVE Online 아이템 또는 함선의 영문명을 입력받아 " +
                "공식 한국어 클라이언트 명칭과 typeID를 반환합니다. " +
                "번역이 필요하거나 팩트체크를 위해 아이템을 식별해야 할 때 사용하세요.",
            parameters: {
                type: "object",
                properties: {
                    en_name: {
                        type: "string",
                        description:
                            "검색할 아이템 또는 함선의 영문 명칭. " +
                            '예: "Rifter", "Drake", "Damage Control II"',
                    },
                },
                required: ["en_name"],
            },
        },
    },

    // ── Skill B ─────────────────────────────────────────────
    {
        type: "function",
        function: {
            name: "get_item_attributes",
            description:
                "typeID를 입력받아 EVE Online 아이템의 세부 스펙(피팅치, 데미지, Mass 등)을 " +
                "반환합니다. translate_and_find_type으로 typeID를 먼저 확인한 후 호출하세요.",
            parameters: {
                type: "object",
                properties: {
                    typeID: {
                        type: "integer",
                        description: "조회할 아이템의 typeID. " + "예: 587 (Rifter), 24698 (Drake)",
                    },
                    attribute_filter: {
                        type: "array",
                        items: { type: "string" },
                        description:
                            "반환할 속성명 필터 목록 (선택사항). " +
                            "지정하지 않으면 모든 속성을 반환합니다. " +
                            '예: ["cpuNeed", "powerNeed", "mass", "hp"]',
                    },
                },
                required: ["typeID"],
            },
        },
    },
];

// ═══════════════════════════════════════════════════════════
//  Part 2: SQL 실행기
// ═══════════════════════════════════════════════════════════

/**
 * AI가 도구(tool)를 호출할 때 실행되는 통합 디스패처.
 *
 * @param {string} toolName   - AI가 선택한 도구 이름
 * @param {object} args       - AI가 전달한 인수 객체
 * @returns {Promise<object>} - 도구 실행 결과 JSON
 *
 * @throws {Error} - 알 수 없는 도구명이거나 SDE 파일이 없는 경우
 */
export async function executeSdeTool(toolName, args) {
    const db = getDb();
    if (!db) {
        throw new Error(
            "SDE 데이터베이스가 아직 준비되지 않았습니다. " +
                "서버 관리자에게 SDE 업데이트 완료 여부를 확인하세요."
        );
    }

    switch (toolName) {
        case "translate_and_find_type":
            return skillTranslateAndFindType(db, args);
        case "get_item_attributes":
            return skillGetItemAttributes(db, args);
        default:
            throw new Error(`알 수 없는 SDE 도구: ${toolName}`);
    }
}

// ───────────────────────────────────────────────────────────
//  Skill A 구현: translate_and_find_type
// ───────────────────────────────────────────────────────────

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ en_name: string }} args
 * @returns {{ typeID: number, en_name: string, kr_name: string | null, found: boolean }}
 */
function skillTranslateAndFindType(db, { en_name }) {
    if (!en_name || typeof en_name !== "string") {
        throw new Error("en_name 인수가 필요합니다.");
    }

    // ── Step 1: 영문 typeName → typeID 조회 ─────────────────
    // invTypes.typeName 컬럼은 기본적으로 영어(en)로 저장됩니다.
    const typeRow = db
        .prepare(
            `SELECT typeID, typeName
             FROM   invTypes
             WHERE  typeName = ?
             LIMIT  1`
        )
        .get(en_name);

    if (!typeRow) {
        return {
            typeID: null,
            en_name,
            kr_name: null,
            found: false,
            message: `'${en_name}'에 해당하는 아이템을 SDE에서 찾을 수 없습니다.`,
        };
    }

    const { typeID, typeName } = typeRow;

    // ── Step 2: trnTranslations에서 한국어(ko) 텍스트 조회 ──
    // trnTranslations 구조:
    //   tcID       INTEGER  — typeID와 매핑되는 번역 컬렉션 ID
    //   keyID      INTEGER  — 각 행을 식별하는 키 (= typeID)
    //   languageID TEXT     — 'en', 'ko', 'de', 'ru', 'ja', 'zh', 'fr'
    //   text       TEXT     — 해당 언어의 번역 텍스트 (아이템명)
    //
    // tcID=8 은 invTypes.typeName에 해당하는 번역 컬렉션입니다.
    const translations = db
        .prepare(
            `SELECT languageID, text
             FROM   trnTranslations
             WHERE  tcID    = 8
               AND  keyID   = ?
               AND  languageID IN ('en', 'ko')`
        )
        .all(typeID);

    const translationMap = Object.fromEntries(translations.map(r => [r.languageID, r.text]));

    return {
        typeID,
        en_name: translationMap["en"] ?? typeName,
        kr_name: translationMap["ko"] ?? null,
        found: true,
    };
}

// ───────────────────────────────────────────────────────────
//  Skill B 구현: get_item_attributes
// ───────────────────────────────────────────────────────────

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ typeID: number, attribute_filter?: string[] }} args
 * @returns {{ typeID: number, attributes: Record<string, { value: number, displayName: string, unit: string | null }> }}
 */
function skillGetItemAttributes(db, { typeID, attribute_filter }) {
    if (typeID === null || typeID === undefined || !Number.isInteger(Number(typeID))) {
        throw new Error("typeID 인수가 필요하며 정수여야 합니다.");
    }

    // ── 타입 존재 여부 사전 확인 ─────────────────────────────
    const typeExists = db
        .prepare(`SELECT 1 FROM invTypes WHERE typeID = ? LIMIT 1`)
        .get(Number(typeID));

    if (!typeExists) {
        return {
            typeID: Number(typeID),
            attributes: {},
            found: false,
            message: `typeID ${typeID}에 해당하는 아이템을 찾을 수 없습니다.`,
        };
    }

    // ── dgmTypeAttributes JOIN dgmAttributeTypes ─────────────
    // dgmTypeAttributes: typeID별 속성 값 테이블
    //   typeID, attributeID, valueInt, valueFloat
    // dgmAttributeTypes: 속성 메타데이터 테이블
    //   attributeID, attributeName, displayName, unitID
    let query = `
        SELECT
            at.attributeName,
            at.displayName,
            u.unitName  AS unit,
            ta.valueInt,
            ta.valueFloat
        FROM   dgmTypeAttributes  ta
        JOIN   dgmAttributeTypes  at ON ta.attributeID = at.attributeID
        LEFT JOIN eveUnits        u  ON at.unitID      = u.unitID
        WHERE  ta.typeID = ?
    `;
    const params = [Number(typeID)];

    // attribute_filter 가 지정된 경우 해당 attributeName만 반환
    if (Array.isArray(attribute_filter) && attribute_filter.length > 0) {
        const placeholders = attribute_filter.map(() => "?").join(", ");
        query += ` AND at.attributeName IN (${placeholders})`;
        params.push(...attribute_filter);
    }

    query += " ORDER BY at.attributeName";

    const rows = db.prepare(query).all(...params);

    // Key-Value 형태로 변환 (valueFloat 우선, 없으면 valueInt)
    const attributes = {};
    for (const row of rows) {
        const value = row.valueFloat ?? row.valueInt;
        attributes[row.attributeName] = {
            value,
            displayName: row.displayName ?? row.attributeName,
            unit: row.unit ?? null,
        };
    }

    return {
        typeID: Number(typeID),
        attributes,
        found: true,
        attributeCount: rows.length,
    };
}

// ═══════════════════════════════════════════════════════════
//  Vercel AI SDK 통합 헬퍼 (선택적 사용)
// ═══════════════════════════════════════════════════════════

/**
 * Vercel AI SDK의 `tool()` 형식으로 변환하여 반환합니다.
 * `generateText` 또는 `streamText`의 `tools` 옵션에 직접 사용하세요.
 *
 * @example
 * import { buildSdeToolsForAiSdk } from './service/sdeSkills.js';
 * const { tools, toolExecutors } = buildSdeToolsForAiSdk();
 *
 * const result = await generateText({
 *   model: google('gemini-2.0-flash'),
 *   tools,
 *   onStepFinish: async ({ toolCalls, toolResults }) => { ... },
 *   prompt: '드레이크 함선의 기본 쉴드 HP를 알려줘',
 * });
 */
export function buildSdeToolsForAiSdk() {
    // Vercel AI SDK는 tools를 { [name]: { description, parameters, execute } } 형식으로 받습니다.
    // 이를 위해 zod 없이 JSON Schema를 그대로 사용하는 방식으로 구성합니다.
    return {
        tools: {
            translate_and_find_type: {
                description: SDE_TOOLS[0].function.description,
                parameters: SDE_TOOLS[0].function.parameters,
                execute: args => executeSdeTool("translate_and_find_type", args),
            },
            get_item_attributes: {
                description: SDE_TOOLS[1].function.description,
                parameters: SDE_TOOLS[1].function.parameters,
                execute: args => executeSdeTool("get_item_attributes", args),
            },
        },
    };
}
