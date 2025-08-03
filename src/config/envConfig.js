//Azure key vault에서 필요한 환경변수(비밀)을 불러옵니다
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import env from 'dotenv';
import ora from 'ora';
import { getRandomLoadingMessage } from '../utils/getRandomLoadingMessage.js';
env.config();

const url = 'https://cat4u-vault.vault.azure.net/';
const credential = new DefaultAzureCredential();
const client = new SecretClient(url, credential);
const isDev = process.env.isDev === 'true';

//새로운 키는 여기에 추가하시면 됩니다 DEV-XXX 유형은 입력하지 않아도 됩니다.
const secretNames = [
    'ESI-CLIENT-ID',
    'ESI-CLIENT-SECRET',
    'ESI-CALLBACK-URL',
    'ESI-SCOPE',
    'MYSQL-IP',
    'MYSQL-PASSWORD',
    'DISCORD-WEBHOOK',
];

const loadSecretsFromVault = async (useDevPrefix = false) => {
    for (const name of secretNames) {
        const keyVaultName = useDevPrefix ? `DEV-${name}` : name;
        try {
            const secret = await client.getSecret(keyVaultName);
            const envKey = name.replace(/-/g, '_');
            process.env[envKey] = secret.value;
        } catch (err) {
            console.error(
                `\n\x1b[31m개발환경?:${isDev}\x1b[0m , ${keyVaultName} 로드 실패 \n ${err.message}`
            );
            process.exit(1);
        }
    }
};

export const importVaultSecrets = async () => {
    if (isDev === undefined) {
        spinner.fail(
            '❌ 시스템 종료 : 환경변수가 설정되지 않았습니다. 프로젝트 루트 디렉터리에 .env 파일을 생성한 뒤, isDev = true 를 입력해 주세요'
        );
        process.exit(1);
    }
    if (isDev === true) {
        console.log('🖥️  개발 환경으로 실행.');
    } else if (isDev === false) {
        console.log('👀  프로덕트 환경으로 실행. 진짜에요???');
    }
    const spinner = ora({
        text: getRandomLoadingMessage(),
        spinner: 'dots',
    }).start();

    await loadSecretsFromVault(isDev);
    spinner.succeed('환경변수 로딩 완료');
};

export default importVaultSecrets;
