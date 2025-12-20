//Azure key vault에서 필요한 환경변수(비밀)을 불러옵니다
import { DefaultAzureCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import { Buffer } from "buffer";
import env from "dotenv";
import ora from "ora";
import { getRandomLoadingMessage } from "../utils/getRandomLoadingMessage.js";
env.config();

const credential = new DefaultAzureCredential();
const isDev = process.env.isDev === "true";
const url = isDev
    ? "https://cat4u-vault.vault.azure.net/"
    : "https://cat4u-web-product.vault.azure.net/";
const client = new SecretClient(url, credential);

//새로운 키는 여기에 추가하시면 됩니다 DEV-XXX 유형은 입력하지 않아도 됩니다.
const secretNames = [
    "ESI-CLIENT-ID",
    "ESI-CLIENT-SECRET",
    "ESI-CALLBACK-URL",
    "ESI-SCOPE",
    "MYSQL-IP",
    "MYSQL-PASSWORD",
    "DISCORD-WEBHOOK",
    "REDIS-SESSION-SECRET", //redis 세션 보안을 위한 키
    "JWT-SECRET",
    "AWS-REGION",
    "AWS-ACCESS-KEY-ID",
    "AWS-SECRET-ACCESS-KEY",
    "AWS-S3-BUCKET-NAME",
];

//공용 개발키 로드
const loadSecretsFromVault = async (isDev = false) => {
    for (const name of secretNames) {
        const keyVaultName = isDev ? `DEV-${name}` : name;
        try {
            const secret = await client.getSecret(keyVaultName);
            const envKey = name.replace(/-/g, "_");
            process.env[envKey] = secret.value;
        } catch (err) {
            console.error(
                `\n\x1b[31m개발환경?:${isDev}\x1b[0m , ${keyVaultName} 로드 실패 \n ${err.message}`
            );
            process.exit(1);
        }
    }
};

//새로운 개인 전용 키는 여기에 추가하시면 됩니다. 개발 환경인 경우 Azure Key vault 계정 정보를 바탕으로 개인의 고유 키가 할당됩니다
const secretPersonalNames = ["AWS-SQS"];

// 개인 개발키 로드
const loadPersonalSecretsFromVault = async (isDev = false) => {
    let userSuffix = "";

    if (isDev) {
        try {
            // 1. Azure AccessToken 획득 및 디코딩
            const tokenResponse = await credential.getToken(
                "https://management.azure.com/.default"
            );
            const payloadBase64 = tokenResponse.token.split(".")[1];
            const decoded = JSON.parse(Buffer.from(payloadBase64, "base64").toString("utf-8"));

            // 2. 식별자 추출 (이메일)
            const email = decoded.email || decoded.upn || decoded.unique_name;

            if (!email) {
                console.error(
                    "\n\x1b[31m[Azure KeyVault] 개인 키 로딩 중 이메일 정보 취득에 실패했습니다.\x1b[0m",
                    `로그 정보 -> upn: ${decoded.upn}, email: ${decoded.email}, unique_name: ${decoded.unique_name}`
                );
                process.exit(1);
            }

            const emailId = email
                .split("@")[0]
                .toUpperCase()
                .replace(/[^A-Z0-9]/g, "-");
            userSuffix = `-${emailId}`;
        } catch (err) {
            console.error(`\x1b[31m[Azure KeyVault] 유저 개인 정보 추출 실패\x1b[0m`, err);
            process.exit(1);
        }
    }

    for (const name of secretPersonalNames) {
        const keyVaultName = isDev ? `${name}${userSuffix}` : name;

        try {
            const secret = await client.getSecret(keyVaultName);
            const envKey = name.replace(/-/g, "_");
            process.env[envKey] = secret.value;
        } catch (err) {
            const errorPrefix = isDev
                ? `개인 설정(${keyVaultName})`
                : `프로덕션 설정(${keyVaultName})`;
            console.error(
                `\n\x1b[31m[Vault] ${errorPrefix} 로드 실패. 개인키가 존재하는지 관리자에게 문의해 주세요.\x1b[0m`
            );
            process.exit(1);
        }
    }

    return userSuffix.replace("-", ""); //ora 출력용
};

export const importVaultSecrets = async () => {
    if (isDev === undefined) {
        spinner.fail(
            "❌ 시스템 종료 : 환경변수가 설정되지 않았습니다. 프로젝트 루트 디렉터리에 .env 파일을 생성한 뒤, isDev = true 를 입력해 주세요"
        );
        process.exit(1);
    }
    if (isDev === true) {
        console.log("🖥️  개발 환경으로 실행.");
    } else if (isDev === false) {
        console.log("👀  프로덕트 환경으로 실행. 진짜에요???");
    }
    const spinner = ora({
        text: getRandomLoadingMessage(),
        spinner: "dots",
    }).start();

    await loadSecretsFromVault(isDev);
    const userId = await loadPersonalSecretsFromVault(isDev);
    const envType = isDev ? `개인:${userId}` : "프로덕션";
    spinner.succeed(`환경변수 로딩 완료 (${envType})`);
};

export default importVaultSecrets;
