import { Webhook, MessageBuilder } from 'discord-webhook-node'; // Discord Webhook과 MessageBuilder 모듈 불러오기
import dotenv from 'dotenv'; // 환경변수 설정을 위한 dotenv 모듈 불러오기
dotenv.config(); // dotenv 설정

console.log('SendDiscordMsg.js active!'); // 클라이언트 생성 로그 출력
/**
 *
 * @param {*} Hook
 * @param {*} Title
 * @param {*} Description
 * @param {*} Color
 */
async function sendMessage(Hook, Title = 'Alert!', Description, Color = '#ff0000') {
    console.log('sendMessage called with:', { Hook, Title, Description, Color }); // 함수 호출 로그 출력
    const hook = new Webhook(Hook);
    const embed = new MessageBuilder()
        .setColor(Color)
        .setTitle(Title)
        .setDescription(Description) // 임베드 메시지 설명 설정
        .setTimestamp(new Date()); // 임베드 메시지에 타임스탬프 추가

    await hook.send(embed); // 임베드 메시지 전송
}

export default sendMessage; // sendMessage 함수를 모듈로 내보내기
