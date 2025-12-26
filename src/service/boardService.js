import { isAllowedEditRole } from "../utils/eveRoleUtils.js";
import { getPrisma } from "./prismaService.js";
//logger 호출 금지. 컨트롤러 레벨에서 호출 하세용
function toBigInt(v, fallback = 0n) {
    try {
        if (v === null || v === undefined || v === "") {
            return fallback;
        }
        return BigInt(v);
    } catch {
        return fallback;
    }
}

function rethrow(err) {
    if (err instanceof Error) {
        throw err;
    }
    throw new Error(String(err));
}

function getNickname(user) {
    const nick = user?.nickname ?? user?.nickName ?? "";
    return String(nick).trim();
}

export async function createBoardService(user, payload) {
    try {
        const { type, board_title, board_content } = payload ?? {};

        const nickname = getNickname(user);
        const prisma = getPrisma();

        const created = await prisma.board.create({
            data: {
                type,
                nickname,
                board_title: board_title.trim(),
                board_content,
                user: {
                    connect: { nickname },
                },
            },
            select: {
                id: true,
                type: true,
                board_title: true,
            },
        });

        return {
            ok: true,
            code: 201,
            message: "게시글 생성 완료",
            data: {
                id: created.id.toString(),
                category: created.type.toLowerCase(),
                board_title: created.board_title,
            },
        };
    } catch (err) {
        rethrow(err);
    }
}

export async function editBoardService(user, payload, board_id) {
    try {
        const { board_title, board_content } = payload ?? {};
        const boardId = toBigInt(board_id);

        const prisma = getPrisma();

        const original = await prisma.board.findFirst({
            where: { id: boardId, is_deleted: 0 },
            select: {
                id: true,
                nickname: true,
                board_title: true,
                board_content: true,
            },
        });

        if (!original) {
            return { ok: false, code: 404, message: "수정할 글을 찾지 못했다옹" };
        }

        const editorNickname = getNickname(user);
        const isOwner = original.nickname === editorNickname;
        const hasEditRole = isAllowedEditRole(user.roles);

        if (!isOwner && !hasEditRole) {
            return { ok: false, code: 403, message: "권한이 없다옹 나가라옹" };
        }

        const nextTitle = board_title.trim(); // 컨트롤러가 이미 검증함

        const [, updated] = await prisma.$transaction([
            prisma.boardHistory.create({
                data: {
                    board_id: boardId,
                    prev_title: original.board_title,
                    prev_content: original.board_content,
                    editor_nickname: editorNickname,
                },
            }),
            prisma.board.update({
                where: { id: boardId },
                data: {
                    board_title: nextTitle,
                    board_content,
                    last_editor_name: editorNickname,
                },
            }),
        ]);

        return {
            ok: true,
            code: 200,
            message: "게시글 수정 완료",
            data: {
                ...updated,
                id: updated.id.toString(),
            },
        };
    } catch (err) {
        rethrow(err);
    }
}

export async function deleteBoardService(user, board_id) {
    try {
        const boardId = BigInt(board_id);

        const prisma = getPrisma();

        const original = await prisma.board.findFirst({
            where: { id: boardId, is_deleted: 0 },
            select: {
                id: true,
                nickname: true,
                board_title: true,
                board_content: true,
            },
        });

        if (!original) {
            return { ok: false, code: 404, message: "삭제할 글을 찾지 못했다옹" };
        }

        const editorNickname = String(user?.nickname ?? user?.nickName ?? "").trim();
        const isOwner = original.nickname === editorNickname;
        const hasEditRole = isAllowedEditRole(user.roles);

        if (!isOwner && !hasEditRole) {
            return { ok: false, code: 403, message: "권한이 없다옹 나가라옹" };
        }

        const [, deleted] = await prisma.$transaction([
            prisma.boardHistory.create({
                data: {
                    board_id: boardId,
                    prev_title: original.board_title,
                    prev_content: original.board_content,
                    editor_nickname: editorNickname,
                },
            }),
            prisma.board.update({
                where: { id: boardId },
                data: {
                    is_deleted: 1,
                    last_editor_name: editorNickname,
                },
            }),
        ]);

        return {
            ok: true,
            code: 200,
            message: "게시글 삭제 완료",
            data: {
                ...deleted,
                id: deleted.id.toString(),
            },
        };
    } catch (err) {
        rethrow(err);
    }
}
