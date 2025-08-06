import { MessageBuilder, Webhook } from 'discord-webhook-node'; // Discord Webhook과 MessageBuilder 모듈 불러오기
import path from 'path';
import { logger } from './logger.js';

let discordUrl; //전역으로 만들어서 재활용 가능하도록
let hook; //전역으로 만들어서 재활용 가능하도록

//setDiscordHook 웹후크 URL 쓰는곳이 여기밖에 없어서 여기서 URL초기화도 맡으면 좋음
export const setDiscordHook = async () => {
    discordUrl = process.env.DISCORD_WEBHOOK;
    if (!discordUrl) {
        console.error('디스코드 웹 후크 주소가 로드되지 않았습니다. 시스템을 종료합니다');
        process.exit(0);
    }

    hook = new Webhook(discordUrl); //겸사겸사 임베드 클라이언트도 설정
    console.log('디스코드 웹후크로 임베드 메세지 발송 준비 완료');
};

/**
 * Discord Webhook을 통해 메시지를 전송합니다.
 *
 * @param {string} Description - 출력할 메시지
 * @param {object} options - 메시지 옵션
 *
 * 바꿀 수 있는 것들 (일부만 선택 가능):
 * - Title: 제목 (기본값 'Alert!')
 * - Url: 제목에 링크 추가
 * - Image: 임베드 이미지 URL
 * - Color: 테두리 색상 ("red","blue" 처럼 기존 정의 값대로 쓰거나, Hex 값 전달로 사용 가능)
 *
 * 사용 예시:
 * await sendMessage('랑조바보', {
 *   Description: '서버 에러 발생',
 *   Title: 'Alert!',
 *   Color: '#ff0000'
 * });
 */
export default async function SendDiscordMsg(
    Description,
    { Title = '알림', Url, Image, Color = 'red' }
) {
    //옵션 값들은 깔끔하게 분리

    const colorHex = COLOR_MAP[Color.toLowerCase()] || Color; // 아래에 정의된 색상에서 가져다 쓰게, 아래에 없다면 입력받은 HEX코드 그대로 사용
    const embed = new MessageBuilder()
        .setColor(colorHex)
        .setTitle(Title)
        .setDescription(Description)
        .setURL(Url)
        .setImage(Image)
        .setTimestamp();

    try {
        await hook.send(embed);

        // 호출자 파일명 추적 GPT한테 물어보면 나옴 내용을 자세히 알 필요는 없음.
        // "어디서" 불렀는지 알면 오류 추적할때 도움이 됨
        // 로그 찍을때 애매하게 해둔 "정보가 일치하지 않습니다" 이따구로 해둔 로깅도 위치 찾을 수 있음
        const stack = new Error().stack.split('\n');
        const callerLine = stack[2] || stack[1]; // 호출한 파일이 보통 2번째 라인에 위치
        const callerPath = callerLine.match(/\((.*):\d+:\d+\)/)?.[1] || 'unknown';
        const callerFile = path.basename(callerPath);

        logger.info(`E번방 디스코드로 메세지 전송 완료! (호출된 함수: ${callerFile})`);
    } catch (err) {
        logger.error(err.message);
    }
}

//언제 어떤 색상을 쓰는지 미리 정의해두면 일관성 유지에 도움이 됨 (사실 굳이 정의하고 싶지 않다면 안해도 됨)
const COLOR_MAP = {
    red: '#ff0000',
    blue: '#0000ff',
    green: '#00ff00',
    yellow: '#ffff00',
    orange: '#ffa500',
    purple: '#800080',
    pink: '#ffc0cb',
    teal: '#008080',
    black: '#000000',
    white: '#ffffff',
    gray: '#808080',
};
