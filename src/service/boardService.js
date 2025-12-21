import { getPrisma } from "./prismaService.js";

export async function createBoardService(user, payload) {
    const { type, board_title, board_content } = payload ?? {};

    const prisma = getPrisma();
    const created = await prisma.board.create({
        data: {
            type,
            character_id: user.characterId,
            board_title: board_title.trim(),
            board_content,
        },
    });

    return created;
}
