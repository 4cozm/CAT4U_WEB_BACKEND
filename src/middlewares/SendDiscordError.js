import { Webhook, MessageBuilder } from 'discord-webhook-node'; // Discord Webhook과 MessageBuilder 모듈 불러오기
import dotenv from 'dotenv'; // 환경변수 설정을 위한 dotenv 모듈 불러오기
dotenv.config(); // dotenv 설정
const hook = new Webhook(process.env.discord_URL); // Discord Webhook URL을 환경변수에서 불러와서 Webhook 객체 생성

console.log('Discord client const complete'); // 클라이언트 생성 로그 출력

async function sendMessage(Description) {
    const embed = new MessageBuilder() // 메시지 빌더 생성
        .setColor('#ff0000ff') // 임베드 메시지 색상 설정
        .setTitle('Alert') // 임베드 메시지 제목 설정
        .setDescription(Description) // 임베드 메시지 설명 설정
        .setTimestamp(new Date()); // 임베드 메시지에 타임스탬프 추가

    await hook.send(embed); // 임베드 메시지 전송
}

export default sendMessage; // sendMessage 함수를 모듈로 내보내기
