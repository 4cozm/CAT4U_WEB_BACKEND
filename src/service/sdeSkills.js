/**
 * @file sdeSkills.js
 * @description EVE Online SDE 기반 AI Function Calling 레이어.
 *
 * `get_eve_item_context` — 동적 Scope 기반 선택적 추출 도구
 *
 *   scope 파라미터로 필요한 데이터 영역만 핀포인트 요청:
 *     identity, base_stats, lore, defense_profile, fitting_profile,
 *     navigation_profile, targeting_profile, capacitor_profile, drone_profile,
 *     dogma_attributes, traits, required_skills, recursive_skills, variations
 *
 *   scope 생략 시 → 전체 영역 반환 (기존 동작 유지 / backward-compatible)
 *
 *   Fuse.js 기반 퍼지 매칭 + 한글 명칭 역방향 조회 fallback 포함.
 */

import fs from "fs";
import Fuse from "fuse.js";
import { SDE_METADATA_PATH } from "../config/sdeConfig.js";
import { getDb } from "./sdeService.js";

// ═══════════════════════════════════════════════════════════
//  상수
// ═══════════════════════════════════════════════════════════

const ALL_SCOPES = [
    "identity",
    "base_stats",
    "lore",
    "defense_profile",
    "fitting_profile",
    "navigation_profile",
    "targeting_profile",
    "capacitor_profile",
    "drone_profile",
    "dogma_attributes",
    "traits",
    "required_skills",
    "recursive_skills",
    "variations",
];

// 스코프별로 필요한 dgmAttributeTypes.attributeName 목록
// 이 이름들은 debug_phase1_sde_data.txt 실측값 기준으로 검증됨
const SCOPE_ATTR_NAMES = {
    defense_profile: [
        "Armor Hitpoints",
        "Shield Capacity",
        "Structure Hitpoints",
        "Signature Radius",
        "Armor EM Damage Resistance",
        "Armor Explosive Damage Resistance",
        "Armor Kinetic Damage Resistance",
        "Armor Thermal Damage Resistance",
        "Shield EM Damage Resistance",
        "Shield Explosive Damage Resistance",
        "Shield Kinetic Damage Resistance",
        "Shield Thermal Damage Resistance",
        "Structure EM Damage Resistance",
        "Structure Explosive Damage Resistance",
        "Structure Kinetic Damage Resistance",
        "Structure Thermal Damage Resistance",
    ],
    fitting_profile: [
        "High Slots",
        "Medium Slots",
        "Low Slots",
        "Turret Hardpoints",
        "Launcher Hardpoints",
        "CPU Output",
        "Powergrid Output",
        "Calibration",
        "Rig Slots",
        "Rig Size",
    ],
    navigation_profile: ["Maximum Velocity", "Inertia Modifier", "Warp Speed Multiplier"],
    targeting_profile: [
        "Maximum Targeting Range",
        "Maximum Locked Targets",
        "Scan Resolution",
        "RADAR Sensor Strength",
        "Ladar Sensor Strength",
        "Magnetometric Sensor Strength",
        "Gravimetric Sensor Strength",
    ],
    capacitor_profile: ["Capacitor Capacity", "Capacitor Recharge time"],
    drone_profile: ["Drone Bandwidth", "Drone Capacity"],
};

// SDE dgmTypeAttributes 스킬 attributeID 고정 매핑
const SKILL_ATTR_MAP = [
    { skillAttrID: 182, levelAttrID: 277 }, // Primary
    { skillAttrID: 183, levelAttrID: 278 }, // Secondary
    { skillAttrID: 184, levelAttrID: 279 }, // Tertiary
];

// ═══════════════════════════════════════════════════════════
//  Part 1: Tool 정의 (Google Native SDK functionDeclarations 포맷)
// ═══════════════════════════════════════════════════════════

export const SDE_TOOLS = [
    // ── 도구 1: 단일 아이템 상세 조회 ─────────────────────────
    {
        type: "function",
        function: {
            name: "get_eve_item_context",
            description:
                "⚠️ SINGLE-ITEM LOOKUP ONLY. " +
                "특정 함선·모듈·스킬 하나의 정확한 스탯(방어력, 피팅, 보너스 등)을 조회할 때만 호출하세요. " +
                "예: 'Guardian의 저항값', 'Tachyon Beam Laser II 스탯', 'Cerberus 피팅'. " +
                "'~의 종류', '~목록', '~에 속하는 모듈'처럼 카테고리/그룹 탐색 요청에는 절대 사용하지 말고 " +
                "search_eve_categories를 사용하세요. " +
                "scope 배열로 필요한 데이터 영역만 핀포인트 요청하세요. " +
                "입력값: 공식 영문 명칭(String) 또는 typeID(Integer).",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        description:
                            "조회할 아이템의 영문 명칭(String) 또는 typeID(Integer). " +
                            '예: "Cerberus", "Damage Control II", 12005, 2048',
                        oneOf: [{ type: "string" }, { type: "integer" }],
                    },
                    scope: {
                        description:
                            "반환할 데이터 영역 배열. 생략 시 모든 영역 반환. " +
                            "identity(계층), base_stats(물리스펙), lore(종족·함선설명), " +
                            "defense_profile(HP+저항값+시그니처), fitting_profile(슬롯·하드포인트·CPU·PG·리그), " +
                            "navigation_profile(속도·관성·정렬시간·워프), targeting_profile(타겟팅·센서), " +
                            "capacitor_profile(캡 용량·충전시간), drone_profile(드론 대역폭·용량), " +
                            "dogma_attributes(전체 raw Dogma — 고급 용도), " +
                            "traits(함선 보너스), required_skills(1차 스킬), " +
                            "recursive_skills(전체 스킬트리·재귀), variations(T1/T2/Faction 계보)",
                        type: "array",
                        items: {
                            type: "string",
                            enum: ALL_SCOPES,
                        },
                    },
                },
                required: ["query"],
            },
        },
    },
    // ── 도구 2: 1:N 카테고리·그룹 탐색 ──────────────────────
    {
        type: "function",
        function: {
            name: "search_eve_categories",
            description:
                "EVE Online 아이템 카테고리·그룹·마켓 분류를 탐색하여 해당 아이템 목록을 반환합니다. " +
                "'~의 종류', '~에 속하는 모듈 목록', '~급 함선'처럼 1:N 그룹 탐색 요청 시 이 도구를 사용하세요. " +
                "예: '미디움 에너지 터렛 종류' → query:'Medium Energy Turret', " +
                "'T2 어설트 프리깃 목록' → query:'Assault Frigate' + meta_filter:['T2'], " +
                "'쉴드 하드너 종류' → query:'Shield Hardener'. " +
                "단일 아이템 스탯 조회(Guardian 방어력 등) → get_eve_item_context 사용.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        description:
                            "탐색할 카테고리/그룹 영문명. 예: 'Medium Energy Turret', 'Shield Hardener', 'Assault Frigate'",
                        type: "string",
                    },
                    meta_filter: {
                        description:
                            "특정 Meta Level만 필터링. 생략 시 전체 반환. 가능한 값: T1, T2, Faction, Deadspace, Officer, Story",
                        type: "array",
                        items: {
                            type: "string",
                            enum: ["T1", "T2", "Faction", "Deadspace", "Officer", "Story"],
                        },
                    },
                    limit: {
                        description: "최대 반환 아이템 수. 기본값 50, 최대 200.",
                        type: "integer",
                    },
                },
                required: ["query"],
            },
        },
    },
];

// ═══════════════════════════════════════════════════════════
//  Part 2: SQL 실행기
// ═══════════════════════════════════════════════════════════

export async function executeSdeTool(toolName, args) {
    const db = getDb();
    if (!db) {
        throw new Error(
            "SDE 데이터베이스가 아직 준비되지 않았습니다. " +
                "서버 관리자에게 SDE 업데이트 완료 여부를 확인하세요."
        );
    }

    let metadata = null;
    try {
        if (fs.existsSync(SDE_METADATA_PATH)) {
            metadata = JSON.parse(fs.readFileSync(SDE_METADATA_PATH, "utf-8"));
        }
    } catch (_) {}

    let apiResponse;
    switch (toolName) {
        case "get_eve_item_context":
            apiResponse = skillGetEveItemContext(db, args);
            break;
        case "search_eve_categories":
            apiResponse = searchEveCategories(db, args);
            break;
        // ── 하위 호환성 유지 (레거시 테스트용) ──────────────────
        case "translate_and_find_type":
            apiResponse = legacyTranslateAndFindType(db, args);
            break;
        case "get_item_attributes":
            apiResponse = legacyGetItemAttributes(db, args);
            break;
        default:
            throw new Error(`알 수 없는 SDE 도구: ${toolName}`);
    }

    if (apiResponse && typeof apiResponse === "object") {
        apiResponse._sde_metadata = metadata || { note: "SDE metadata pending or unavailable" };
    }

    return apiResponse;
}

// ═══════════════════════════════════════════════════════════
//  Core Skill: get_eve_item_context
// ═══════════════════════════════════════════════════════════

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ query: string | number, scope?: string[] }} args
 */
function skillGetEveItemContext(db, { query, scope }) {
    if (query === null || query === undefined) {
        throw new Error("query 인수가 필요합니다 (영문 아이템명 또는 typeID).");
    }

    // ── Step 1: typeID 결정 ───────────────────────────────────
    const typeID = resolveTypeId(db, query);
    if (!typeID) {
        return {
            found: false,
            query,
            message: `'${query}'에 해당하는 아이템을 SDE에서 찾을 수 없습니다.`,
        };
    }

    // ── Step 2: scope 정규화 (생략/빈 배열 → 전체) ────────────
    const activeScopes = new Set(!scope || scope.length === 0 ? ALL_SCOPES : scope);

    // ── Step 3: Identity (항상 실행) ─────────────────────────
    const identity = queryIdentity(db, typeID);
    if (!identity) {
        return {
            found: false,
            typeID,
            query,
            message: `typeID ${typeID}에 해당하는 아이템 정보를 찾을 수 없습니다.`,
        };
    }

    const __localization = {};
    const result = { found: true, typeID: identity.typeID, typeName: identity.typeName };

    // ── Step 4: 공식 한국어 명칭 수집 ────────────────────────
    const trRows = db
        .prepare(
            `SELECT tcID, text FROM trnTranslations
             WHERE languageID = 'ko'
               AND ((tcID = 8 AND keyID = ?) OR (tcID = 7 AND keyID = ?) OR (tcID = 6 AND keyID = ?))`
        )
        .all(identity.typeID, identity.groupID, identity.categoryID);
    for (const r of trRows) {
        if (r.tcID === 8) {
            __localization[identity.typeName] = r.text;
        }
        if (r.tcID === 7) {
            __localization[identity.groupName] = r.text;
        }
        if (r.tcID === 6) {
            __localization[identity.categoryName] = r.text;
        }
    }

    // ── Step 5: Scope별 SQL 모듈 선택적 실행 ─────────────────

    if (activeScopes.has("identity")) {
        result.hierarchy = { category: identity.categoryName, group: identity.groupName };
    }

    if (activeScopes.has("base_stats")) {
        result.baseStats = {
            mass: identity.mass,
            volume: identity.volume,
            capacity: identity.capacity,
        };
    }

    if (activeScopes.has("lore")) {
        result.lore = buildLore(db, identity);
    }

    // ── 배치 attribute 쿼리 전략 ─────────────────────────────
    // dogma_attributes, defense_profile, fitting_profile, navigation_profile,
    // targeting_profile, capacitor_profile, drone_profile 은 모두 dgmTypeAttributes에서 옴.
    // dogma_attributes(전체)가 요청된 경우 → 전체 쿼리 1회로 공유.
    // 나머지 profile 스코프만 요청된 경우 → 필요한 attribute name만 IN절로 1회 배치 쿼리.

    const PROFILE_SCOPES = [
        "defense_profile",
        "fitting_profile",
        "navigation_profile",
        "targeting_profile",
        "capacitor_profile",
        "drone_profile",
    ];
    const activeProfiles = PROFILE_SCOPES.filter(s => activeScopes.has(s));

    if (activeScopes.has("dogma_attributes") || activeProfiles.length > 0) {
        let attrMap = null; // attributeName → value 맵
        let fullAttrRows = null; // defense_profile의 buildResistSummary용

        if (activeScopes.has("dogma_attributes")) {
            // 전체 쿼리 1회 — 모든 profile 스코프도 이걸로 공유
            fullAttrRows = queryDogmaAttributes(db, typeID);
            attrMap = {};
            for (const r of fullAttrRows) {
                if (r.attributeName !== null) {
                    attrMap[r.attributeName] = r.valueFloat ?? r.valueInt;
                }
            }
            result.dogmaAttributes = { ...attrMap };
        } else if (activeProfiles.length > 0) {
            // 필요한 attribute name만 수집해 단 1회 배치 쿼리
            const neededNames = new Set();
            for (const ps of activeProfiles) {
                for (const n of SCOPE_ATTR_NAMES[ps] ?? []) {
                    neededNames.add(n);
                }
            }
            const rows = queryAttributesByNames(db, typeID, [...neededNames]);
            attrMap = {};
            for (const r of rows) {
                attrMap[r.attributeName] = r.valueFloat ?? r.valueInt;
            }
            // defense_profile의 저항값 계산용으로 rows 재활용
            fullAttrRows = rows;
        }

        if (activeScopes.has("defense_profile") && attrMap) {
            result.defenseProfile = buildDefenseProfile(fullAttrRows, attrMap);
        }
        if (activeScopes.has("fitting_profile") && attrMap) {
            result.fittingProfile = buildFittingProfile(attrMap);
        }
        if (activeScopes.has("navigation_profile") && attrMap) {
            result.navigationProfile = buildNavigationProfile(attrMap, identity.mass);
        }
        if (activeScopes.has("targeting_profile") && attrMap) {
            result.targetingProfile = buildTargetingProfile(attrMap);
        }
        if (activeScopes.has("capacitor_profile") && attrMap) {
            result.capacitorProfile = buildCapacitorProfile(attrMap);
        }
        if (activeScopes.has("drone_profile") && attrMap) {
            result.droneProfile = buildDroneProfile(attrMap);
        }
    }

    if (activeScopes.has("traits")) {
        const { traits, localization } = queryTraits(db, typeID);
        result.traits = traits;
        Object.assign(__localization, localization);
    }

    // recursive_skills는 required_skills의 완전한 상위집합
    if (activeScopes.has("recursive_skills")) {
        result.skillTree = queryRecursiveSkillTree(db, typeID);
    } else if (activeScopes.has("required_skills")) {
        const { skills, localization } = queryDirectSkills(db, typeID);
        result.requiredSkills = skills;
        Object.assign(__localization, localization);
    }

    if (activeScopes.has("variations")) {
        result.variations = queryVariations(db, typeID);
    }

    result.__localization = __localization;
    return result;
}

// ═══════════════════════════════════════════════════════════
//  SQL 모듈 함수들
// ═══════════════════════════════════════════════════════════

/**
 * typeID 결정: 숫자 직접값 → 영문 정확 일치 → 한글 fallback → Fuse.js 퍼지 매칭
 * @param {import('better-sqlite3').Database} db
 * @param {string|number} query
 * @returns {number|null}
 */
function resolveTypeId(db, query) {
    if (typeof query === "number" || (typeof query === "string" && /^\d+$/.test(query))) {
        return Number(query);
    }

    // 영문명 정확 일치
    const exactRow = db
        .prepare(`SELECT typeID FROM invTypes WHERE typeName = ? LIMIT 1`)
        .get(query);
    if (exactRow) {
        return exactRow.typeID;
    }

    // 한글 명칭 fallback
    const koRow = db
        .prepare(
            `SELECT t.typeID
             FROM   trnTranslations tr
             JOIN   invTypes t ON t.typeID = tr.keyID
             WHERE  tr.tcID       = 8
               AND  tr.languageID = 'ko'
               AND  tr.text       = ?
             LIMIT  1`
        )
        .get(query);
    if (koRow) {
        return koRow.typeID;
    }

    // Fuse.js 퍼지 매칭 (마지막 fallback)
    const candidates = db.prepare(`SELECT typeID, typeName FROM invTypes LIMIT 100000`).all();
    const fuse = new Fuse(candidates, { keys: ["typeName"], threshold: 0.35, distance: 200 });
    const results = fuse.search(String(query), { limit: 3 });

    if (results.length > 0) {
        const best = results[0].item;
        console.log(
            `  \x1b[90m[SDE Fuse] "${query}" → "${best.typeName}" (typeID=${best.typeID})\x1b[0m`
        );
        return best.typeID;
    }

    return null;
}

/**
 * 아이템 계층 정보 조회 (invTypes + invGroups + invCategories)
 * @param {import('better-sqlite3').Database} db
 * @param {number} typeID
 */
function queryIdentity(db, typeID) {
    return db
        .prepare(
            `SELECT
                t.typeID,
                t.typeName,
                t.mass,
                t.volume,
                t.capacity,
                t.raceID,
                t.description,
                g.groupID,
                g.groupName,
                c.categoryID,
                c.categoryName
             FROM   invTypes       t
             JOIN   invGroups      g ON t.groupID    = g.groupID
             JOIN   invCategories  c ON g.categoryID = c.categoryID
             WHERE  t.typeID = ?
             LIMIT  1`
        )
        .get(typeID);
}

/**
 * Lore 데이터 조회 (race + description)
 * raceID → chrRaces.raceName, invTypes.description 사용
 * @param {import('better-sqlite3').Database} db
 * @param {object} identity - queryIdentity 결과
 * @returns {{ race: string|null, description: string|null }}
 */
function buildLore(db, identity) {
    let race = null;
    if (identity.raceID) {
        try {
            const raceRow = db
                .prepare(`SELECT raceName FROM chrRaces WHERE raceID = ? LIMIT 1`)
                .get(identity.raceID);
            race = raceRow?.raceName ?? null;
        } catch (_) {
            /* chrRaces 테이블이 없을 경우 안전하게 실패 */
        }
    }
    return {
        race,
        description: identity.description || null,
    };
}

/**
 * 특정 attributeName 목록만 타겟팬 쿼리 (N수 IN 절 배치)
 * profile 스코프 전용 상작 쿼리를 1회로 줄이는 핵심 함수
 * @param {import('better-sqlite3').Database} db
 * @param {number} typeID
 * @param {string[]} names
 * @returns {Array<{attributeName:string, valueFloat:number|null, valueInt:number|null}>}
 */
function queryAttributesByNames(db, typeID, names) {
    if (!names || names.length === 0) {
        return [];
    }
    const placeholders = names.map(() => "?").join(", ");
    return db
        .prepare(
            `SELECT at.attributeName, ta.valueFloat, ta.valueInt
             FROM   dgmTypeAttributes  ta
             JOIN   dgmAttributeTypes  at ON ta.attributeID = at.attributeID
             WHERE  ta.typeID = ?
               AND  at.attributeName IN (${placeholders})`
        )
        .all(typeID, ...names);
}

/**
 * 전체 Dogma 속성 조회
 * @param {import('better-sqlite3').Database} db
 * @param {number} typeID
 * @returns {Array}
 */
function queryDogmaAttributes(db, typeID) {
    return db
        .prepare(
            `SELECT
                at.attributeName,
                u.unitName,
                ta.valueInt,
                ta.valueFloat
             FROM   dgmTypeAttributes  ta
             JOIN   dgmAttributeTypes  at ON ta.attributeID = at.attributeID
             LEFT JOIN eveUnits        u  ON at.unitID      = u.unitID
             WHERE  ta.typeID = ?
             ORDER BY at.attributeName`
        )
        .all(typeID);
}

/**
 * defense_profile 빌더: HP + 저항값 + 시그니처 반경 통합
 * @param {Array} attrRows - queryDogmaAttributes 또는 queryAttributesByNames 결과
 * @param {object} attrMap - attributeName → value 맵
 * @returns {object}
 */
function buildDefenseProfile(attrRows, attrMap) {
    // HP
    const hp = {
        armor: attrMap["Armor Hitpoints"] ?? null,
        shield: attrMap["Shield Capacity"] ?? null,
        structure: attrMap["Structure Hitpoints"] ?? null,
    };
    const signatureRadius = attrMap["Signature Radius"] ?? null;

    // 저항값 (1 - multiplier) × 100
    const resistances = { armor: {}, shield: {}, structure: {} };
    const dmgTypes = [
        { key: "em", suffix: "EM Damage Resistance" },
        { key: "ex", suffix: "Explosive Damage Resistance" },
        { key: "ki", suffix: "Kinetic Damage Resistance" },
        { key: "th", suffix: "Thermal Damage Resistance" },
    ];
    for (const { key, suffix } of dmgTypes) {
        const getResist = layer => {
            const raw = attrMap[`${layer} ${suffix}`];
            return raw !== null ? parseFloat(((1 - raw) * 100).toFixed(2)) : null;
        };
        resistances.armor[key] = getResist("Armor");
        resistances.shield[key] = getResist("Shield");
        resistances.structure[key] = getResist("Structure");
    }

    // AI 가독성 요약
    const summaryParts = [];
    if (hp.armor !== null) {
        summaryParts.push(`Armor HP: ${hp.armor}`);
    }
    if (hp.shield !== null) {
        summaryParts.push(`Shield HP: ${hp.shield}`);
    }
    if (hp.structure !== null) {
        summaryParts.push(`Structure HP: ${hp.structure}`);
    }
    if (signatureRadius !== null) {
        summaryParts.push(`Sig Radius: ${signatureRadius}m`);
    }
    const r = resistances;
    summaryParts.push(
        `Armor: EM ${r.armor.em}% EX ${r.armor.ex}% KI ${r.armor.ki}% TH ${r.armor.th}%`,
        `Shield: EM ${r.shield.em}% EX ${r.shield.ex}% KI ${r.shield.ki}% TH ${r.shield.th}%`,
        `Structure: EM ${r.structure.em}% EX ${r.structure.ex}% KI ${r.structure.ki}% TH ${r.structure.th}%`
    );

    return { hp, signatureRadius, resistances, summary: summaryParts.join(" | ") };
}

/**
 * fitting_profile 빌더: 슬롯, 하드포인트, CPU, PG, 리그
 * @param {object} attrMap
 * @returns {object}
 */
function buildFittingProfile(attrMap) {
    return {
        slots: {
            high: attrMap["High Slots"] ?? null,
            medium: attrMap["Medium Slots"] ?? null,
            low: attrMap["Low Slots"] ?? null,
            rig: attrMap["Rig Slots"] ?? null,
            rigSize: attrMap["Rig Size"] ?? null,
        },
        hardpoints: {
            turret: attrMap["Turret Hardpoints"] ?? null,
            launcher: attrMap["Launcher Hardpoints"] ?? null,
        },
        cpu: attrMap["CPU Output"] ?? null,
        powergrid: attrMap["Powergrid Output"] ?? null,
        calibration: attrMap["Calibration"] ?? null,
    };
}

/**
 * navigation_profile 빌더: 속도, 관성, 정렬시간(관성 공식 계산), 워프
 * 정렬시간(s) = -ln(0.25) × mass(kg) × inertiaModifier / 1,000,000
 * @param {object} attrMap
 * @param {number} mass - invTypes.mass (kg)
 * @returns {object}
 */
function buildNavigationProfile(attrMap, mass) {
    const inertia = attrMap["Inertia Modifier"] ?? null;
    const velocity = attrMap["Maximum Velocity"] ?? null;
    const warpSpeed = attrMap["Warp Speed Multiplier"] ?? null;

    let alignTime = null;
    if (mass && inertia) {
        // 이브 공식: 커서는 0.25 속도에 도달할 때를 툀다고 보는 시간
        alignTime = parseFloat(((-Math.log(0.25) * mass * inertia) / 1_000_000).toFixed(2));
    }

    return { maxVelocity: velocity, inertiaModifier: inertia, alignTime, warpSpeed };
}

/**
 * targeting_profile 빌더: 타겟팅 범위, 잠금, 스캔 해상도, 센서
 * @param {object} attrMap
 * @returns {object}
 */
function buildTargetingProfile(attrMap) {
    const sensors = [
        { type: "RADAR", value: attrMap["RADAR Sensor Strength"] ?? 0 },
        { type: "Ladar", value: attrMap["Ladar Sensor Strength"] ?? 0 },
        { type: "Magnetometric", value: attrMap["Magnetometric Sensor Strength"] ?? 0 },
        { type: "Gravimetric", value: attrMap["Gravimetric Sensor Strength"] ?? 0 },
    ];
    const dominant = sensors.reduce((a, b) => (a.value > b.value ? a : b));

    return {
        maxTargetingRange: attrMap["Maximum Targeting Range"] ?? null,
        maxLockedTargets: attrMap["Maximum Locked Targets"] ?? null,
        scanResolution: attrMap["Scan Resolution"] ?? null,
        sensorType: dominant.value > 0 ? dominant.type : null,
        sensorStrength: dominant.value > 0 ? dominant.value : null,
    };
}

/**
 * capacitor_profile 빌더: 컨덧스 쯸위와 충전 시간
 * @param {object} attrMap
 * @returns {object}
 */
function buildCapacitorProfile(attrMap) {
    return {
        capacity: attrMap["Capacitor Capacity"] ?? null,
        rechargeTime: attrMap["Capacitor Recharge time"] ?? null, // ms
    };
}

/**
 * drone_profile 빌더: 드론 대역폭과 용량
 * @param {object} attrMap
 * @returns {object}
 */
function buildDroneProfile(attrMap) {
    return {
        bandwidth: attrMap["Drone Bandwidth"] ?? null,
        capacity: attrMap["Drone Capacity"] ?? null,
    };
}

/**
 * 함선 Traits/보너스 조회 (invTraits)
 * @param {import('better-sqlite3').Database} db
 * @param {number} typeID
 * @returns {{ traits: string[], localization: object }}
 */
function queryTraits(db, typeID) {
    const traitRows = db
        .prepare(
            `
            SELECT t.traitID, t.bonus, t.unitID, tr.text as krText, t.bonusText as enText
            FROM invTraits t
            LEFT JOIN trnTranslations tr
              ON t.traitID = tr.keyID AND tr.tcID = 1002 AND tr.languageID = 'ko'
            WHERE t.typeID = ?
        `
        )
        .all(typeID);

    const traits = [];
    const localization = {};
    for (const row of traitRows) {
        let enText = row.enText ? row.enText.replace(/<[^>]+>/g, "") : "";
        let krText = row.krText ? row.krText.replace(/<[^>]+>/g, "") : "";
        if (!enText) {
            continue;
        }
        if (row.bonus !== null) {
            let valStr = String(row.bonus);
            if (row.unitID === 105 || row.unitID === 124 || row.unitID === 109) {
                valStr += "%";
            } else if (row.unitID === 1) {
                valStr += "m";
            } else if (row.unitID === 14) {
                valStr += "x";
            } else {
                valStr += ` (Unit ID: ${row.unitID})`;
            }
            enText = `${valStr} ${enText}`;
            if (krText) {
                krText = `${valStr} ${krText}`;
            }
        }
        traits.push(enText);
        if (krText) {
            localization[enText] = krText;
        }
    }
    return { traits, localization };
}

/**
 * 1차 요구 스킬 조회 (깊이 1, 재귀 없음)
 * @param {import('better-sqlite3').Database} db
 * @param {number} typeID
 * @returns {{ skills: Array<{typeID: number, typeName: string, requiredLevel: number}>, localization: object }}
 */
function queryDirectSkills(db, typeID) {
    const skillAttrIDs = SKILL_ATTR_MAP.map(m => m.skillAttrID);
    const levelAttrIDs = SKILL_ATTR_MAP.map(m => m.levelAttrID);
    const allAttrIDs = [...skillAttrIDs, ...levelAttrIDs];

    const attrRows = db
        .prepare(
            `SELECT attributeID, valueFloat, valueInt
             FROM dgmTypeAttributes
             WHERE typeID = ?
               AND attributeID IN (${allAttrIDs.join(",")})`
        )
        .all(typeID);

    const attrMap = {};
    for (const r of attrRows) {
        attrMap[r.attributeID] = r.valueFloat ?? r.valueInt;
    }

    const skillEntries = SKILL_ATTR_MAP.map(m => ({
        skillTypeID: attrMap[m.skillAttrID],
        level: attrMap[m.levelAttrID],
    })).filter(e => e.skillTypeID);

    if (skillEntries.length === 0) {
        return { skills: [], localization: {} };
    }

    const skillIDs = skillEntries.map(e => e.skillTypeID);
    const skillRows = db
        .prepare(
            `SELECT t.typeID, t.typeName, tr.text AS krName
             FROM invTypes t
             LEFT JOIN trnTranslations tr
               ON t.typeID = tr.keyID AND tr.tcID = 8 AND tr.languageID = 'ko'
             WHERE t.typeID IN (${skillIDs.join(",")})`
        )
        .all();

    const nameMap = {};
    const localization = {};
    for (const r of skillRows) {
        nameMap[r.typeID] = r.typeName;
        if (r.krName && r.krName !== r.typeName) {
            localization[r.typeName] = r.krName;
        }
    }

    const skills = skillEntries.map(e => ({
        typeID: e.skillTypeID,
        typeName: nameMap[e.skillTypeID] ?? `typeID(${e.skillTypeID})`,
        requiredLevel: e.level ?? null,
    }));

    return { skills, localization };
}

/**
 * 전체 요구 스킬 트리 재귀 조회 — Recursive CTE + Self-Join
 *
 * dgmTypeAttributes에서 스킬 ID(attributeID 182/183/184)와
 * 요구 레벨(attributeID 277/278/279)을 Self-Join으로 한 번에 묶어
 * 코루틴 서브쿼리의 N번 재스캔을 제거합니다.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} rootTypeID
 * @returns {Array<{depth: number, parentTypeID: number, skillTypeID: number, skillName: string, requiredLevel: number}>}
 */
function queryRecursiveSkillTree(db, rootTypeID) {
    const joinConditions = SKILL_ATTR_MAP.map(
        m => `(sid.attributeID = ${m.skillAttrID} AND slv.attributeID = ${m.levelAttrID})`
    ).join(" OR ");

    const sql = `
        WITH RECURSIVE skill_tree AS (

            -- ── Base: 대상 아이템의 직접 요구 스킬 + 레벨 (Self-Join)
            SELECT
                :rootTypeID                      AS parent_typeID,
                CAST(sid.valueFloat AS INTEGER)  AS skill_typeID,
                CAST(slv.valueFloat AS INTEGER)  AS required_level,
                0                                AS depth
            FROM dgmTypeAttributes sid
            JOIN dgmTypeAttributes slv
              ON  slv.typeID = sid.typeID
              AND (${joinConditions})
            WHERE sid.typeID = :rootTypeID

            UNION ALL

            -- ── Recursive: 각 스킬의 하위 요구 스킬도 Self-Join으로 탐색
            SELECT
                CAST(st.skill_typeID AS INTEGER)  AS parent_typeID,
                CAST(sid.valueFloat  AS INTEGER)  AS skill_typeID,
                CAST(slv.valueFloat  AS INTEGER)  AS required_level,
                st.depth + 1                      AS depth
            FROM skill_tree st
            JOIN dgmTypeAttributes sid
              ON  sid.typeID = CAST(st.skill_typeID AS INTEGER)
            JOIN dgmTypeAttributes slv
              ON  slv.typeID = sid.typeID
              AND (${joinConditions})
            WHERE st.depth < 6
        )
        SELECT
            st.depth,
            st.parent_typeID    AS parentTypeID,
            st.skill_typeID     AS skillTypeID,
            t.typeName          AS skillName,
            st.required_level   AS requiredLevel
        FROM skill_tree st
        JOIN invTypes t ON t.typeID = st.skill_typeID
        ORDER BY st.depth, st.parent_typeID
    `;

    return db.prepare(sql).all({ rootTypeID });
}

/**
 * Variation 계보 조회 — invMetaTypes 기반 T1/T2/Faction 패밀리 매핑
 *
 * 대상이 파생품(T2/Faction 등)이면 parentTypeID를 통해 T1 원형으로 소급하고,
 * 원형 기준으로 전체 패밀리를 조회합니다.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} typeID
 * @returns {{ rootTypeID: number, rootName: string, family: Array }}
 */
function queryVariations(db, typeID) {
    // 대상 아이템의 meta 정보 확인
    const selfMeta = db
        .prepare(
            `SELECT typeID, parentTypeID, metaGroupID FROM invMetaTypes WHERE typeID = ? LIMIT 1`
        )
        .get(typeID);

    // T1 원형 결정: 대상이 파생품이면 parentTypeID, 아니면 대상 자체
    const rootTypeID = selfMeta?.parentTypeID ?? typeID;

    // T1 원형 명칭
    const rootRow = db
        .prepare(`SELECT typeName FROM invTypes WHERE typeID = ? LIMIT 1`)
        .get(rootTypeID);

    const sql = `
        SELECT
            mt.typeID,
            t.typeName,
            mt.metaGroupID,
            mg.metaGroupName,
            mt.parentTypeID,
            CASE WHEN mt.typeID = :queryTypeID THEN 1 ELSE 0 END AS isTarget
        FROM invMetaTypes   mt
        JOIN invTypes       t  ON mt.typeID      = t.typeID
        JOIN invMetaGroups  mg ON mt.metaGroupID = mg.metaGroupID
        WHERE mt.parentTypeID = :rootTypeID
           OR mt.typeID       = :rootTypeID
        ORDER BY mt.metaGroupID, mt.typeID
    `;

    const family = db.prepare(sql).all({ queryTypeID: typeID, rootTypeID });

    // T1 원형이 invMetaTypes에 없는 경우 (순수 T1은 행이 없을 수 있음) 수동 추가
    const rootInFamily = family.some(r => r.typeID === rootTypeID);
    if (!rootInFamily && rootRow) {
        family.unshift({
            typeID: rootTypeID,
            typeName: rootRow.typeName,
            metaGroupID: 1, // Tech I
            metaGroupName: "Tech I",
            parentTypeID: null,
            isTarget: rootTypeID === typeID ? 1 : 0,
        });
    }

    return {
        rootTypeID,
        rootName: rootRow?.typeName ?? `typeID(${rootTypeID})`,
        family,
    };
}

// ═══════════════════════════════════════════════════════════
//  레거시 스킬 (하위 호환 유지 — 직접 테스트용)
// ═══════════════════════════════════════════════════════════

function legacyTranslateAndFindType(db, { en_name }) {
    if (!en_name || typeof en_name !== "string") {
        throw new Error("en_name 인수가 필요합니다.");
    }

    let typeRow = db
        .prepare(`SELECT typeID, typeName FROM invTypes WHERE typeName = ? LIMIT 1`)
        .get(en_name);

    if (!typeRow) {
        const koRow = db
            .prepare(
                `SELECT t.typeID, t.typeName
                 FROM   trnTranslations tr
                 JOIN   invTypes t ON t.typeID = tr.keyID
                 WHERE  tr.tcID = 8 AND tr.languageID = 'ko' AND tr.text = ?
                 LIMIT  1`
            )
            .get(en_name);
        if (koRow) {
            typeRow = koRow;
        }
    }

    if (!typeRow) {
        return {
            typeID: null,
            en_name,
            kr_name: null,
            found: false,
            message: `'${en_name}'에 해당하는 아이템을 찾을 수 없습니다.`,
        };
    }

    const { typeID, typeName } = typeRow;
    const translations = db
        .prepare(
            `SELECT languageID, text FROM trnTranslations
             WHERE tcID = 8 AND keyID = ? AND languageID IN ('en', 'ko')`
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

function legacyGetItemAttributes(db, { typeID, attribute_filter }) {
    if (typeID === null || typeID === undefined || !Number.isInteger(Number(typeID))) {
        throw new Error("typeID 인수가 필요하며 정수여야 합니다.");
    }

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

    let query = `
        SELECT at.attributeName, at.displayName, u.unitName AS unit, ta.valueInt, ta.valueFloat
        FROM   dgmTypeAttributes  ta
        JOIN   dgmAttributeTypes  at ON ta.attributeID = at.attributeID
        LEFT JOIN eveUnits        u  ON at.unitID      = u.unitID
        WHERE  ta.typeID = ?
    `;
    const params = [Number(typeID)];

    if (Array.isArray(attribute_filter) && attribute_filter.length > 0) {
        const placeholders = attribute_filter.map(() => "?").join(", ");
        query += ` AND at.attributeName IN (${placeholders})`;
        params.push(...attribute_filter);
    }
    query += " ORDER BY at.attributeName";

    const rows = db.prepare(query).all(...params);
    const attributes = {};
    for (const row of rows) {
        const value = row.valueFloat ?? row.valueInt;
        attributes[row.attributeName] = {
            value,
            displayName: row.displayName ?? row.attributeName,
            unit: row.unit ?? null,
        };
    }

    return { typeID: Number(typeID), attributes, found: true, attributeCount: rows.length };
}

// ═══════════════════════════════════════════════════════════
//  search_eve_categories: 1:N 카테고리 검색
// ═══════════════════════════════════════════════════════════

// metaGroupName → 레이블 정규화 맵
const META_GROUP_LABEL = {
    1: "T1",
    2: "T2",
    3: "Story",
    4: "Faction",
    5: "Deadspace",
    6: "Officer",
};
// meta_filter 레이블 → metaGroupID 역매핑
const META_LABEL_TO_ID = {
    T1: 1,
    T2: 2,
    Story: 3,
    Faction: 4,
    Deadspace: 5,
    Officer: 6,
};

// 결과를 Meta Level 기준으로 그룹화
function groupByMetaLevel(rows) {
    const grouped = {};
    for (const row of rows) {
        const label = META_GROUP_LABEL[row.metaGroupID] ?? "T1";
        if (!grouped[label]) {
            grouped[label] = [];
        }
        grouped[label].push({ typeID: row.typeID, typeName: row.typeName });
    }
    return grouped;
}

// groupID 배열로 아이템 목록 조회 (더미 필터 포함)
function fetchItemsByGroupIDs(db, groupIDs, metaFilterIDs, limit) {
    const gPlaceholders = groupIDs.map(() => "?").join(", ");
    let sql = `
        SELECT
            t.typeID,
            t.typeName,
            COALESCE(imt.metaGroupID, 1) AS metaGroupID
        FROM invTypes t
        JOIN invGroups g ON t.groupID = g.groupID
        LEFT JOIN invMetaTypes imt ON t.typeID = imt.typeID
        WHERE g.groupID IN (${gPlaceholders})
          AND t.published = 1
          AND t.marketGroupID IS NOT NULL
          AND g.categoryID NOT IN (16, 9)
    `;
    const params = [...groupIDs];

    if (metaFilterIDs && metaFilterIDs.length > 0) {
        // T1(metaGroupID=NULL→COALESCE→1) 포함 처리
        const mPlaceholders = metaFilterIDs.map(() => "?").join(", ");
        sql += ` AND COALESCE(imt.metaGroupID, 1) IN (${mPlaceholders})`;
        params.push(...metaFilterIDs);
    }

    sql += ` ORDER BY COALESCE(imt.metaGroupID, 1), t.typeName LIMIT ?`;
    params.push(limit);

    return db.prepare(sql).all(...params);
}

// marketGroupID 배열로 아이템 목록 조회 (더미 필터 포함)
function fetchItemsByMarketGroupIDs(db, marketGroupIDs, metaFilterIDs, limit) {
    const mgPlaceholders = marketGroupIDs.map(() => "?").join(", ");
    let sql = `
        SELECT
            t.typeID,
            t.typeName,
            COALESCE(imt.metaGroupID, 1) AS metaGroupID
        FROM invTypes t
        JOIN invGroups g ON t.groupID = g.groupID
        LEFT JOIN invMetaTypes imt ON t.typeID = imt.typeID
        WHERE t.marketGroupID IN (${mgPlaceholders})
          AND t.published = 1
          AND g.categoryID NOT IN (16, 9)
    `;
    const params = [...marketGroupIDs];

    if (metaFilterIDs && metaFilterIDs.length > 0) {
        const mPlaceholders = metaFilterIDs.map(() => "?").join(", ");
        sql += ` AND COALESCE(imt.metaGroupID, 1) IN (${mPlaceholders})`;
        params.push(...metaFilterIDs);
    }

    sql += ` ORDER BY COALESCE(imt.metaGroupID, 1), t.typeName LIMIT ?`;
    params.push(limit);

    return db.prepare(sql).all(...params);
}

/**
 * 1:N 카테고리 검색 — 3단계 폭포수 전략
 *
 * 전략 1: invGroups.groupName 정확 일치
 * 전략 2: invMarketGroups.marketGroupName LIKE 검색 (재귀 CTE로 하위 그룹까지)
 * 전략 3: Fuse.js 퍼지 매칭 (invGroups 기준)
 *
 * @param {import('better-sqlite3').Database} db
 * @param {{ query: string, meta_filter?: string[], limit?: number }} args
 */
function searchEveCategories(db, { query, meta_filter, limit = 50 }) {
    if (!query || typeof query !== "string") {
        throw new Error("query 인수가 필요합니다 (카테고리/그룹 영문명).");
    }

    const safeLimit = Math.min(Number(limit) || 50, 200);
    const metaFilterIDs = (meta_filter || []).map(l => META_LABEL_TO_ID[l]).filter(Boolean);

    // ── 전략 1: invGroups.groupName 정확 일치 ────────────────
    const exactGroups = db
        .prepare(
            `SELECT groupID, groupName, categoryID
             FROM invGroups
             WHERE groupName = ? AND published = 1
             LIMIT 5`
        )
        .all(query);

    if (exactGroups.length > 0) {
        // 스킬/청사진 카테고리 제외 후 그룹 선택
        const validGroups = exactGroups.filter(g => ![16, 9].includes(g.categoryID));
        const groupIDs = validGroups.map(g => g.groupID);

        if (groupIDs.length > 0) {
            const rows = fetchItemsByGroupIDs(db, groupIDs, metaFilterIDs, safeLimit);
            if (rows.length > 0) {
                return {
                    found: true,
                    strategy: "group_exact_match",
                    searchTerm: query,
                    matchedGroup: {
                        groupID: validGroups[0].groupID,
                        groupName: validGroups[0].groupName,
                    },
                    totalCount: rows.length,
                    byMetaLevel: groupByMetaLevel(rows),
                };
            }
        }
    }

    // ── 전략 2: invMarketGroups 계층 이름(Flattened Path) 다중 키워드 일치 ──
    // 예: "Medium Energy Turret" → pathName: "... Energy Turrets Medium" 매칭!
    const tokens = query.split(/\s+/).filter(Boolean);
    const likeConditions = tokens.map(() => `LOWER(pathName) LIKE LOWER(?)`).join(" AND ");
    const likeParams = tokens.map(t => `%${t}%`);

    const marketGroupSQL = `
        WITH RECURSIVE market_path AS (
            SELECT marketGroupID, marketGroupName AS pathName
            FROM invMarketGroups
            WHERE parentGroupID IS NULL

            UNION ALL

            SELECT c.marketGroupID, p.pathName || ' ' || c.marketGroupName
            FROM invMarketGroups c
            JOIN market_path p ON c.parentGroupID = p.marketGroupID
        )
        SELECT marketGroupID, pathName 
        FROM market_path
        WHERE ${likeConditions}
    `;
    const marketGroups = db.prepare(marketGroupSQL).all(...likeParams);

    if (marketGroups.length > 0) {
        // 매칭된 모든 노드(자식까지)의 marketGroupID 수집
        // 단, 트리 상의 자식 노드들도 조건에 맞으면 위 쿼리에서 모두 반환됨
        // (예: "Energy Turret" 검색 시 parent와 모든 자식이 조건에 부합하여 반환)
        const marketGroupIDs = marketGroups.map(g => g.marketGroupID);
        const rows = fetchItemsByMarketGroupIDs(db, marketGroupIDs, metaFilterIDs, safeLimit);

        if (rows.length > 0) {
            return {
                found: true,
                strategy: "market_group_path_match",
                searchTerm: query,
                matchedGroup: { path: marketGroups[0].pathName },
                totalCount: rows.length,
                byMetaLevel: groupByMetaLevel(rows),
            };
        }
    }

    // ── 전략 3: Fuse.js 퍼지 매칭 (invGroups 기준) ───────────
    const allGroups = db
        .prepare(
            `SELECT groupID, groupName, categoryID
             FROM invGroups
             WHERE published = 1 AND categoryID NOT IN (16, 9)
             LIMIT 10000`
        )
        .all();

    const fuse = new Fuse(allGroups, { keys: ["groupName"], threshold: 0.35, distance: 200 });
    const fuseResults = fuse.search(query, { limit: 3 });

    if (fuseResults.length > 0) {
        const best = fuseResults[0].item;
        console.log(
            `  \x1b[90m[SDE Category Fuse] "${query}" → "${best.groupName}" (groupID=${best.groupID})\x1b[0m`
        );
        const rows = fetchItemsByGroupIDs(db, [best.groupID], metaFilterIDs, safeLimit);

        if (rows.length > 0) {
            return {
                found: true,
                strategy: "fuzzy_match",
                searchTerm: query,
                matchedGroup: { groupID: best.groupID, groupName: best.groupName },
                totalCount: rows.length,
                byMetaLevel: groupByMetaLevel(rows),
            };
        }
    }

    return {
        found: false,
        searchTerm: query,
        message: `'${query}'에 해당하는 카테고리/그룹을 SDE에서 찾을 수 없습니다.`,
    };
}

// ═══════════════════════════════════════════════════════════
//  Google Native SDK 통합 헬퍼
// ═══════════════════════════════════════════════════════════

/**
 * @google/generative-ai 네이티브 SDK용 functionDeclarations 배열 반환
 */
export function buildSdeFunctionDeclarations() {
    return SDE_TOOLS.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
    }));
}

/**
 * Vercel AI SDK용 tool() 래퍼 (하위 호환 유지)
 */
export async function buildSdeToolsForAiSdk() {
    const { tool } = await import("ai");
    const { z } = await import("zod");

    return {
        tools: {
            get_eve_item_context: tool({
                description: SDE_TOOLS[0].function.description,
                parameters: z.object({
                    query: z
                        .union([z.string(), z.number().int()])
                        .describe('영문 아이템명 또는 typeID. 예: "Cerberus", 12005'),
                    scope: z
                        .array(z.enum(ALL_SCOPES))
                        .optional()
                        .describe("반환할 데이터 영역 배열. 생략 시 전체 반환."),
                }),
                execute: async args => executeSdeTool("get_eve_item_context", args),
            }),
            search_eve_categories: tool({
                description: SDE_TOOLS[1].function.description,
                parameters: z.object({
                    query: z.string().describe("탐색할 카테고리/그룹 영문명"),
                    meta_filter: z
                        .array(z.enum(["T1", "T2", "Faction", "Deadspace", "Officer", "Story"]))
                        .optional()
                        .describe("특정 Meta Level 필터링. 생략 시 전체."),
                    limit: z.number().int().optional().describe("최대 반환 수. 기본 50."),
                }),
                execute: async args => executeSdeTool("search_eve_categories", args),
            }),
        },
    };
}
