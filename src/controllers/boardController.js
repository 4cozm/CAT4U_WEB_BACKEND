import { createBoardService } from "../service/boardService.js";
import { getPrisma } from "../service/prismaService.js";
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
            logger().warn(`${printUserInfo(req)} 게시글 타입 파싱 에러 발생 type : ${type}`); //파싱 오류는 개발 문제일 가능성 높아서 warn 처리
            return res.status(400).json({ message: "게시글 타입이 올바르지 않다옹" });
        }

        // 2. 제목 검증
        if (!board_title || !board_title.trim()) {
            logger().info(`${printUserInfo(req)} 제목을 빈칸으로 작성해 오류 발생`);
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
                return res.status(400).json({ message: "내용은 빈칸이 될 수 없다옹" });
            }
        } catch (parseErr) {
            logger().warn("게시글 내용 파싱 에러:", parseErr);
            return res.status(400).json({ message: "올바르지 않은 게시글 형식이라옹" });
        }

        // 4. 서비스 호출
        const created = await createBoardService(req.user, req.body);

        logger().info(`${printUserInfo(req)} 게시글 생성 완료 : ${board_title}`);
        return res.status(201).json(created);
    } catch (err) {
        if (err?.status) {
            logger().info(`게시글 작성중 사용자 주도 에러 발생`, err);
            return res.status(err.status).json({ message: err.message });
        }
        logger().warn(`[createBoard] 알 수 없는 에러 발생`, err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getBoardDetail = async (req, res) => {
    try {
        const { category, id } = req.query;
        const prisma = getPrisma();

        if (!category || !id) {
            return res.status(400).json({ message: "필수 파라미터가 누락되었다옹" });
        }

        const board = await prisma.board.findFirst({
            where: {
                id: BigInt(id),
                type: category.toUpperCase(),
                is_deleted: 0,
            },
            include: {
                user: {
                    select: {
                        nickname: true,
                        character_id: true, // BigInt 타입
                    },
                },
            },
        });

        if (!board) {
            return res.status(404).json({ message: "존재하지 않거나 삭제된 게시글이라옹" });
        }
        const responseData = {
            ...board,
            id: board.id.toString(),
            user: {
                ...board.user,
                character_id: board.user.character_id.toString(),
            },
        };

        return res.status(200).json({
            success: true,
            data: responseData,
        });
    } catch (err) {
        console.error("게시글 조회 중 에러:", err);
        return res.status(500).json({ message: "서버 에러가 발생했다옹" });
    }
};

export const getBoardList = async (req, res) => {
    try {
        logger().debug("게시글 리스트 요청", req.query.type);
        const { type, page = 1, limit = 10 } = req.query; // 기본값: 1페이지, 10개씩
        const prisma = getPrisma();
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // 전체 게시글 개수 확인 (페이지네이션 UI 계산용)
        const totalCount = await prisma.board.count({
            where: { type: type.toUpperCase(), is_deleted: 0 },
        });

        const posts = await prisma.board.findMany({
            where: {
                type: type.toUpperCase(),
                is_deleted: 0,
            },
            orderBy: {
                create_dt: "desc",
            },
            skip: skip, // 몇 개를 건너뛸지
            take: take, // 몇 개를 가져올지
            select: {
                id: true,
                board_title: true,
                create_dt: true,
                nickname: true,
                user: { select: { corp: true } },
            },
        });

        const formattedPosts = posts.map(post => ({
            ...post,
            id: post.id.toString(),
        }));

        // 데이터와 함께 메타 정보(전체 개수 등)를 반환
        return res.status(200).json({
            posts: formattedPosts,
            totalCount,
            totalPages: Math.ceil(totalCount / take),
            currentPage: Number(page),
        });
    } catch (err) {
        console.error("목록 조회 에러:", err);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
