import { Webhook, MessageBuilder } from 'discord-webhook-node'; // Discord Webhook과 MessageBuilder 모듈 불러오기
import dotenv from 'dotenv'; // 환경변수 설정을 위한 dotenv 모듈 불러오기
import logger from './logger.js';
dotenv.config(); // dotenv 설정

console.log('SendDiscordMsg.js active!'); // 클라이언트 생성 로그 출력
/**
 * Discord Webhook을 통해 메시지를 전송합니다. (Written by GPT)
 *
 * @async
 * @function
 * @param {string} Hook - Discord Webhook URL입니다.
 * @param {string} [Title='Alert!'] - 임베드 메시지의 제목입니다.
 * @param {string} Description - 임베드 메시지의 본문 내용입니다.
 * @param {string} [Url] - 제목에 링크를 추가할 URL입니다.
 * @param {string} [Image] - 임베드에 표시할 이미지 URL입니다.
 * @param {string} [Color='#ff0000'] - 임베드 테두리 색상 (Hex 코드)입니다.
 * @returns {Promise<void>} - 메시지 전송 완료 시 반환됩니다.
 */
async function sendMessage(
    Hook,
    Title = 'Alert!',
    Description,
    Url = undefined,
    Image = undefined,
    Color = '#ff0000'
) {
    const hook = new Webhook(Hook);
    const embed = new MessageBuilder()
        .setColor(Color)
        .setTitle(Title)
        .setDescription(Description)
        .setURL(Url)
        .setImage(Image)
        .setTimestamp();

    try {
        await hook.send(embed);
        logger.info('Discord message sent successfully!');
    } catch (err) {
        logger.error(err.message);
    }
}

export default sendMessage;
