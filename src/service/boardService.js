import { isAllowedEditRole } from "../utils/eveRoleUtils.js";
import { rethrow } from "../utils/rethrow.js";
import { getPrisma } from "./prismaService.js";
import { applyFileRefCountDelta } from "./s3RefService.js";
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

function getNickname(user) {
    const nick = user?.nickname ?? user?.nickName ?? "";
    return String(nick).trim();
}

export async function createBoardService(user, payload) {
    try {
        const { type, board_title, board_content } = payload ?? {};

        const nickname = getNickname(user);
        const prisma = getPrisma();
        await prisma.$transaction(async tx => {
            const created = await tx.board.create({
                data: {
                    type,
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

            await applyFileRefCountDelta(tx, board_content, {
                debug: true,
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
        });
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

        const nextTitle = board_title.trim();

        const prevTitle = (original.board_title ?? "").trim();
        const prevContentStr =
            typeof original.board_content === "string"
                ? original.board_content
                : JSON.stringify(original.board_content ?? []);

        const nextContentStr =
            typeof board_content === "string" ? board_content : JSON.stringify(board_content ?? []);

        const titleChanged = prevTitle !== nextTitle;
        const contentChanged = prevContentStr !== nextContentStr;

        if (!titleChanged && !contentChanged) {
            // 변경 없음. DB 쓰기/히스토리/증감 전부 스킵
            return {
                ok: true,
                code: 200,
                message: "바뀐 내용이 없다옹...",
                data: { ...original, id: original.id.toString() },
            };
        }

        const updated = await prisma.$transaction(async tx => {
            await tx.boardHistory.create({
                data: {
                    board_id: boardId,
                    prev_title: original.board_title,
                    prev_content: original.board_content,
                    editor_nickname: editorNickname,
                },
            });

            const updatedRow = await tx.board.update({
                where: { id: boardId },
                data: {
                    board_title: nextTitle,
                    board_content,
                    last_editor_name: editorNickname,
                },
            });

            // ref_count 증감 (수정 전/후 비교)
            await applyFileRefCountDelta(tx, board_content, {
                prevContent: original.board_content,
                // s3Prefix는 기본(process.env.AWS_S3_URL) 쓰면 생략 가능
            });

            return updatedRow;
        });

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

export async function toggleLikeService(req) {
    const userId = BigInt(req.user.characterId);
    const boardId = BigInt(req.params.id);
    const prisma = getPrisma();
    if (!userId || !boardId) {
        return { ok: false, code: 400, message: "필수 정보가 빠졌다옹.." };
    }

    try {
        const result = await prisma.$transaction(async tx => {
            const existing = await tx.boardLike.findUnique({
                where: { user_id_board_id: { user_id: userId, board_id: boardId } },
                select: { id: true },
            });

            if (existing) {
                await tx.boardLike.delete({
                    where: { user_id_board_id: { user_id: userId, board_id: boardId } },
                });

                await tx.board.update({
                    where: { id: boardId },
                    data: { recommend_cnt: { decrement: 1 } },
                });

                return { ok: true, code: 200, like: false, message: "👎따봉을 회수했다옹" };
            }

            await tx.boardLike.create({
                data: { user_id: userId, board_id: boardId },
            });

            await tx.board.update({
                where: { id: boardId },
                data: { recommend_cnt: { increment: 1 } },
            });

            return { ok: true, code: 200, like: true, message: "👍게시글에 따봉을 줬다옹" };
        });

        return result;
    } catch (err) {
        rethrow(err);
    }
}
