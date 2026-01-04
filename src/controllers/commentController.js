// controllers/comment.controller.js
import {
    createCommentService,
    deleteCommentService,
    listCommentsService,
    updateCommentService,
} from "../service/commentService.js";
import { logger } from "../utils/logger.js";
import printUserInfo from "../utils/printUserInfo.js";

function pickBoardId(req) {
    return req?.query?.boardId ?? req?.body?.boardId ?? null;
}

function pickCommentId(req) {
    return req?.query?.commentId ?? req?.body?.commentId ?? null;
}

export const listComments = async (req, res) => {
    try {
        const result = await listCommentsService(req);

        if (!result.ok && result.code !== 400) {
            logger().warn(`${printUserInfo(req)} / 댓글 목록 조회 중 서버측 로직 에러 의심`);
        }
        return res.status(result.code).json(result);
    } catch (err) {
        logger().warn(`${printUserInfo(req)} 댓글 목록 조회 중 예외 발생`, err);
        return res.status(500).json({ ok: false, code: 500, message: "서버 오류가 발생했다옹" });
    }
};

export const createComment = async (req, res) => {
    try {
        const result = await createCommentService(req);

        if (!result.ok && result.code !== 400) {
            logger().warn(
                `${printUserInfo(req)} / 댓글 작성 로직 처리중 서버측 에러 발생 의심 (boardId:${pickBoardId(req)})`
            );
        }

        logger().info(
            `${printUserInfo(req)} 댓글 작성 요청. boardId:${pickBoardId(req)} status:${result.code} message:${result.message}`
        );

        return res.status(result.code).json(result);
    } catch (err) {
        logger().warn(`${printUserInfo(req)} 댓글 작성 중 예외 발생`, err);
        return res.status(500).json({ ok: false, code: 500, message: "서버 오류가 발생했다옹" });
    }
};

export const updateComment = async (req, res) => {
    try {
        const result = await updateCommentService(req);
        const commentId = pickCommentId(req);

        if (!result.ok || result.code === 403) {
            logger().warn(
                `${printUserInfo(req)} 권한이 없는 댓글 수정 요청. commentId:${commentId}`
            );
        }

        logger().info(
            `${printUserInfo(req)} 댓글 수정 요청. commentId:${commentId} status:${result.code} message:${result.message}`
        );

        return res.status(result.code).json(result);
    } catch (err) {
        logger().warn(`${printUserInfo(req)} 댓글 수정 중 예외 발생`, err);
        return res.status(500).json({ ok: false, code: 500, message: "서버 오류가 발생했다옹" });
    }
};

export const deleteComment = async (req, res) => {
    try {
        const result = await deleteCommentService(req);
        const commentId = pickCommentId(req);

        if (!result.ok || result.code === 403) {
            logger().warn(
                `${printUserInfo(req)} 권한이 없는 댓글 삭제 요청. commentId:${commentId}`
            );
        }

        logger().info(
            `${printUserInfo(req)} 댓글 삭제 요청. commentId:${commentId} status:${result.code} message:${result.message}`
        );

        return res.status(result.code).json(result);
    } catch (err) {
        logger().warn(`${printUserInfo(req)} 댓글 삭제 중 예외 발생`, err);
        return res.status(500).json({ ok: false, code: 500, message: "서버 오류가 발생했다옹" });
    }
};
