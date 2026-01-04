import { getPrisma } from "../service/prismaService.js";
import { rethrow } from "../utils/rethrow.js";

function ok(payload = {}) {
    return { ok: true, code: 200, ...payload };
}

function fail(code, message, payload = {}) {
    return { ok: false, code, message, ...payload };
}

function toBigIntSafe(v) {
    try {
        if (typeof v === "bigint") {
            return v;
        }
        if (v === null || v === undefined || v === "") {
            return null;
        }
        return BigInt(v);
    } catch {
        return null;
    }
}

function normalizeComment(row) {
    if (!row) {
        return row;
    }

    return {
        ...row,
        id: row.id?.toString?.() ?? row.id,
        user_id: row.user_id?.toString?.() ?? row.user_id,
        board_id: row.board_id?.toString?.() ?? row.board_id,
        user: row.user
            ? {
                  ...row.user,
                  character_id: row.user.character_id?.toString?.() ?? row.user.character_id,
                  id: row.user.id?.toString?.() ?? row.user.id,
              }
            : undefined,
    };
}

function getAuth(req) {
    const u = req?.user || {};
    const nickname = u.nickname ?? u.nickName ?? u.name ?? null;
    const characterId = u.characterId ?? u.character_id ?? null;
    const roles = u.roles ?? u.Role ?? [];
    return { nickname, characterId, roles };
}

function getCommentIdFromReq(req) {
    return (
        toBigIntSafe(req?.body?.commentId) ??
        toBigIntSafe(req?.query?.commentId) ??
        toBigIntSafe(req?.params?.id) ??
        null
    );
}

/**
 * POST /api/comment
 * body: { boardId, content }
 */
export async function createCommentService(req) {
    try {
        const { characterId } = getAuth(req);

        const boardId = toBigIntSafe(req?.body?.boardId);
        const content = (req?.body?.content ?? "").trim();

        if (!boardId) {
            return fail(400, "boardId가 올바르지 않다옹");
        }
        if (!content) {
            return fail(400, "댓글 내용을 입력해달라옹");
        }
        if (content.length > 5000) {
            return fail(400, "댓글이 너무 길다옹");
        }

        const uid = toBigIntSafe(characterId);
        if (!uid) {
            return fail(401, "유저 정보가 올바르지 않다옹");
        }

        const prisma = getPrisma();

        const board = await prisma.board.findFirst({
            where: { id: boardId, is_deleted: 0 },
            select: { id: true },
        });
        if (!board) {
            return fail(404, "게시글이 존재하지 않는다옹");
        }

        const created = await prisma.comment.create({
            data: {
                user_id: uid,
                board_id: boardId,
                content,
            },
            include: {
                user: {
                    select: {
                        character_id: true,
                        nickname: true,
                        corp: true,
                        Role: true,
                    },
                },
            },
        });

        return ok({
            message: "댓글을 작성했다옹",
            data: normalizeComment(created),
        });
    } catch (err) {
        rethrow(err, { where: "commentService.createCommentService" });
    }
}

/**
 * GET /api/comment?boardId=...&cursor=...&take=...
 */
export async function listCommentsService(req) {
    try {
        const boardId = toBigIntSafe(req?.query?.boardId);
        const cursor = toBigIntSafe(req?.query?.cursor);
        const takeRaw = Number(req?.query?.take ?? 20);
        const take = Math.min(Math.max(takeRaw || 20, 1), 50);

        if (!boardId) {
            return fail(400, "boardId가 올바르지 않다옹");
        }

        const prisma = getPrisma();

        const rows = await prisma.comment.findMany({
            where: { board_id: boardId, is_deleted: 0 },
            take,
            ...(cursor
                ? {
                      cursor: { id: cursor },
                      skip: 1,
                  }
                : {}),
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
            include: {
                user: {
                    select: {
                        character_id: true,
                        nickname: true,
                        corp: true,
                        Role: true,
                    },
                },
            },
        });

        const items = rows.map(normalizeComment);
        const nextCursor = rows.length === take ? items[items.length - 1].id : null;

        return ok({
            items,
            nextCursor,
        });
    } catch (err) {
        rethrow(err, { where: "commentService.listCommentsService" });
    }
}

/**
 * PATCH /api/comment
 * body: { commentId, content }
 */
export async function updateCommentService(req) {
    try {
        const { characterId } = getAuth(req);

        const commentId = getCommentIdFromReq(req);
        const content = (req?.body?.content ?? "").trim();

        if (!commentId) {
            return fail(400, "commentId가 올바르지 않다옹");
        }
        if (!content) {
            return fail(400, "댓글 내용을 입력해달라옹");
        }
        if (content.length > 5000) {
            return fail(400, "댓글이 너무 길다옹");
        }

        const uid = toBigIntSafe(characterId);
        if (!uid) {
            return fail(401, "유저 정보가 올바르지 않다옹");
        }

        const prisma = getPrisma();

        const existing = await prisma.comment.findFirst({
            where: { id: commentId, is_deleted: 0 },
            select: { id: true, user_id: true },
        });

        if (!existing) {
            return fail(404, "댓글이 존재하지 않는다옹");
        }
        if (existing.user_id !== uid) {
            return fail(403, "수정 권한이 없다옹");
        }

        const updated = await prisma.comment.update({
            where: { id: commentId },
            data: { content },
            include: {
                user: {
                    select: {
                        character_id: true,
                        nickname: true,
                        corp: true,
                        Role: true,
                    },
                },
            },
        });

        return ok({
            message: "댓글을 수정했다옹",
            data: normalizeComment(updated),
        });
    } catch (err) {
        rethrow(err, { where: "commentService.updateCommentService" });
    }
}

/**
 * DELETE /api/comment
 * body: { commentId }  (또는 query: ?commentId=)
 * soft delete: is_deleted = 1
 */
export async function deleteCommentService(req) {
    try {
        const { characterId } = getAuth(req);
        if (!characterId) {
            return fail(401, "로그인이 필요하다옹");
        }

        const commentId = getCommentIdFromReq(req);
        if (!commentId) {
            return fail(400, "commentId가 올바르지 않다옹");
        }

        const uid = toBigIntSafe(characterId);
        if (!uid) {
            return fail(401, "유저 정보가 올바르지 않다옹");
        }

        const prisma = getPrisma();

        const existing = await prisma.comment.findFirst({
            where: { id: commentId, is_deleted: 0 },
            select: { id: true, user_id: true },
        });

        if (!existing) {
            return fail(404, "댓글이 존재하지 않는다옹");
        }
        if (existing.user_id !== uid) {
            return fail(403, "삭제 권한이 없다옹");
        }

        await prisma.comment.update({
            where: { id: commentId },
            data: { is_deleted: 1 },
        });

        return ok({
            message: "댓글을 삭제했다옹",
        });
    } catch (err) {
        rethrow(err, { where: "commentService.deleteCommentService" });
    }
}
