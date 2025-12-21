import { createBoardService } from "../service/boardService.js";
import { logger } from "../utils/logger.js";
import printUserInfo from "../utils/printUserInfo.js";
const ALLOWED_TYPES = ["GUIDE", "DOCTRINE", "FITTING", "MARKET"];

/**
 * POST /api/board
 * Body: { board_title: string, board_content: string }
 */
export const createBoard = async (req, res) => {
    try {
        logger().debug("게시글 저장 요청 받음");
        const { type, board_title, board_content } = req.body || {};

        // 1. 타입 검증
        if (!ALLOWED_TYPES.includes(type)) {
            return res.status(400).json({ message: "게시글 타입이 올바르지 않다옹" });
        }

        // 2. 제목 검증
        if (!board_title || !board_title.trim()) {
            return res.status(400).json({ message: "제목은 빈칸이 될 수 없다옹" });
        }

        // 3. 내용 검증 (BlockNote 빈 객체 방어)
        try {
            const parsedContent = JSON.parse(board_content || "[]");

            // 텍스트 내용이 있거나, 이미지/파일 등 다른 타입의 블록이 있는지 확인
            const hasActualContent = parsedContent.some(block => {
                // 텍스트가 있는 경우
                const hasText = block.content?.some(
                    item => item.text && item.text.trim().length > 0
                );
                // 이미지나 다른 기능성 블록인 경우 (paragraph가 아니면 일단 내용이 있다고 간주)
                const isNotParagraph = block.type !== "paragraph";

                return hasText || isNotParagraph;
            });

            if (!hasActualContent) {
                logger().info(`${printUserInfo(req)} 게시글 저장 실패 : 실제 내용 없음`);
                return res.status(400).json({ message: "내용은 빈칸이 될 수 없다옹" });
            }
        } catch (parseErr) {
            logger().warn("게시글 내용 파싱 에러:", parseErr);
            return res.status(400).json({ message: "올바르지 않은 게시글 형식이라옹" });
        }

        // 4. 서비스 호출
        const created = await createBoardService(req.user, req.body);

        const responseData = {
            ...created,
            id: created.id.toString(),
            character_id: created.character_id.toString(),
        };

        logger().info(`${printUserInfo(req)} 게시글 생성 완료 : ${board_title}`);
        return res.status(201).json(responseData);
    } catch (err) {
        if (err?.status) {
            logger().info(`게시글 작성중 사용자 주도 에러 발생`, err);
            return res.status(err.status).json({ message: err.message });
        }
        logger().warn(`[createBoard] 알 수 없는 에러 발생`, err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
