//Azure key vault에서 필요한 환경변수(비밀)을 불러옵니다
import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';
import { getRandomLoadingMessage } from '../utils/getRandomLoadingMessage.js';
import env from 'dotenv';
import ora from 'ora';
env.config();

const url = 'https://cat4u-vault.vault.azure.net/';
const credential = new DefaultAzureCredential();
const client = new SecretClient(url, credential);
const isDev = process.env.isDev === 'true';

const secretNames = ['ESI-CLIENT-ID', 'ESI-CLIENT-SECRET', 'ESI-CALLBACK-URL', 'ESI-SCOPE'];

const loadSecretsFromVault = async (useDevPrefix = false) => {
    for (const name of secretNames) {
        const keyVaultName = useDevPrefix ? `DEV-${name}` : name;
        try {
            const secret = await client.getSecret(keyVaultName);
            const envKey = name.replace(/-/g, '_');
            process.env[envKey] = secret.value;
        } catch (err) {
            console.error(`${keyVaultName} 로드 실패: ${err.message}`);
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
        console.log('🖥️  개발 환경으로 환경변수를 로드 합니다.');
    } else if (isDev === false) {
        console.log('👀  프로덕트 환경변수를 로드 합니다.');
    }
    const spinner = ora({
        text: getRandomLoadingMessage(),
        spinner: 'dots',
    }).start();

    await loadSecretsFromVault(isDev);
    spinner.succeed('환경변수 로딩 완료');
};

export default importVaultSecrets;
