import axios from 'axios';
import fs from 'fs';
import { stdin as input, stdout as output } from 'node:process';
import ora from 'ora';
import path from 'path';
import readline from 'readline/promises';
import unzipper from 'unzipper';
import { upsertEnvVar } from '../utils/envFile.js';

const OWNER = '4cozm';
const REPO = 'CAT4U_WEB_FRONTEND';
const OUTPUT_DIR = './public/frontend';

/**
 * GitHub Actions 아티팩트 목록을 조회합니다.
 * @param {string} owner - GitHub 사용자명
 * @param {string} repo - GitHub 저장소명
 * @param {string} token - GitHub Personal Access Token
 * @returns {Promise<Array>} 아티팩트 목록
 */
export async function getAllArtifacts(owner, repo, token) {
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
    const response = await axios.get(url, {
        headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
        },
    });
    return response.data.artifacts;
}

/**
 * 현재 환경에 맞는 가장 최신 아티팩트를 반환합니다.
 * @param {Array} artifacts - 아티팩트 배열
 * @returns {Object|null} 최신 아티팩트 객체
 */
export function findLatestArtifact(artifacts) {
    if (!Array.isArray(artifacts) || artifacts.length === 0) {
        return null;
    }

    const prefix = process.env.isDev === 'true' ? 'dev' : 'main';

    // prefix로 필터링
    const filtered = artifacts.filter(a => a.name && a.name.startsWith(prefix));

    if (filtered.length === 0) {
        return null; // 해당 브랜치용 아티팩트 없음
    }

    // 최신순 정렬 후 첫 번째 반환
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

export async function deployFrontendOnStartup() {
    try {
        const artifacts = await getAllArtifacts(OWNER, REPO, process.env.WEB_ARTIFACT_TOKEN);
        if (!artifacts.length) {
            console.warn('아티팩트 리스트가 비어있습니다.');
            return null;
        }

        let targetArtifact;
        const changeMode = process.env.changeArtifactMode === 'true';

        if (changeMode) {
            // 수동 선택 모드
            targetArtifact = await pickArtifactFromList(artifacts);
            if (!targetArtifact) {
                console.log('선택이 취소되었습니다.');
                return null;
            }
        } else {
            // 최신 버전 자동 선택
            const latest = findLatestArtifact(artifacts);
            if (!latest) {
                console.warn('아티팩트를 찾을 수 없습니다.');
                return null;
            }

            if (isFrontendUpToDate(latest.name)) {
                console.log(
                    `프론트 아티팩트가 이미 최신입니다!  버전:${formatArtifactTimestamp(latest.name)} 업데이트는 건너뛸게요🐰`
                );
                return null;
            }

            // Dev 환경이면 다운로드 전 확인
            const isDev = process.env.isDev === 'true';
            if (isDev) {
                const proceed = await confirm(
                    `🍕 Dev 모드: 최신 아티팩트(${latest.name})를 다운로드 및 배포할까요? 3초 뒤 자동 건너뜀`,
                    { defaultYes: false }
                );
                if (!proceed) {
                    console.log('🥲 개발환경: 사용자 입력으로 인해 다운로드/배포를 취소합니다.');
                    return null;
                }
            }

            targetArtifact = latest;
        }

        // 다운로드 & 배포
        const spinner = ora(`아티팩트 다운로드 중... (${targetArtifact.name})`).start();
        const zipPath = await downloadArtifact(targetArtifact);
        if (!zipPath) {
            spinner.fail('ZIP 다운로드 실패');
            return null;
        }

        const success = await extractArtifact(zipPath);
        if (!success) {
            spinner.fail('압축 해제 실패');
            return null;
        }

        saveFrontendVersion(targetArtifact.name);
        spinner.succeed(
            `아티팩트 다운로드 및 배포 완료: ${formatArtifactTimestamp(targetArtifact.name)}`
        );
        return true;
    } catch (e) {
        ora().fail('서버 시작 중 아티팩트 다운로드 실패');
        console.error(e.message);
        return null;
    }
}

/**
 * 최신 아티팩트를 ZIP으로 다운로드합니다.
 * @returns {Promise<string|null>} ZIP 파일 경로
 */
export async function downloadArtifact(latest) {
    const spinner = ora('GitHub 아티팩트 목록 조회 중...').start();
    try {
        if (!latest) {
            spinner.fail('❌ 최신 아티팩트가 존재하지 않습니다.');
            return null;
        }
        spinner.text = `📦 아티팩트 다운로드 중: ${latest.name}`;
        const zipUrl = `https://api.github.com/repos/${OWNER}/${REPO}/actions/artifacts/${latest.id}/zip`;
        const response = await axios.get(zipUrl, {
            headers: {
                Authorization: `token ${process.env.WEB_ARTIFACT_TOKEN}`,
                Accept: 'application/vnd.github+json',
            },
            responseType: 'stream',
        });

        const zipPath = './artifact.zip';
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        spinner.succeed('ZIP 파일 다운로드 완료');
        await upsertEnvVar('changeArtifactMode', false);
        return zipPath;
    } catch (error) {
        spinner.fail('아티팩트 ZIP 다운로드 실패');
        console.error(error.message);
        return null;
    }
}

/**
 * ZIP 파일을 지정된 경로에 압축 해제합니다.
 * @param {string} zipPath - 다운로드된 ZIP 파일 경로
 * @param {string} [outputDir=OUTPUT_DIR] - 압축 해제 대상 디렉토리
 * @returns {Promise<boolean>} 성공 여부
 */
export async function extractArtifact(zipPath, outputDir = OUTPUT_DIR) {
    const spinner = ora('ZIP 파일 압축 해제 중...').start();

    try {
        await fs
            .createReadStream(zipPath)
            .pipe(unzipper.Extract({ path: outputDir }))
            .promise();

        fs.unlinkSync(zipPath); // ZIP 파일 삭제
        spinner.succeed('아티팩트 압축 해제 완료');
        return true;
    } catch (error) {
        spinner.fail('아티팩트 압축 해제 실패');
        console.error(error.message);
        return false;
    }
}

/**
 * 프론트엔드 정적 파일 폴더(public/frontend)에 버전 정보를 저장합니다.
 * @param {string} version - 배포 버전 정보 (예: artifact 이름, 빌드 버전)
 */
export function saveFrontendVersion(version) {
    const outputDir = path.join(process.cwd(), 'public', 'frontend');

    try {
        const versionFilePath = path.join(outputDir, 'version.json');
        const versionInfo = {
            version,
            deployedAt: new Date().toISOString(),
        };

        fs.writeFileSync(versionFilePath, JSON.stringify(versionInfo, null, 2));
        return true;
    } catch (error) {
        console.error('프론트 엔드 최신 버전 정보 저장 실패:', error.message);
        return false;
    }
}

/**
 * 저장된 프론트엔드 버전이 최신인지 확인합니다.
 * @param {string} latestName - 새로 확인된 artifact 이름 (예: frontend-export-20250803143751)
 * @returns {boolean} - 저장된 버전과 동일하면 true, 다르면 false
 */
export function isFrontendUpToDate(latestName) {
    const versionFilePath = path.join(process.cwd(), 'public', 'frontend', 'version.json');

    try {
        if (!fs.existsSync(versionFilePath)) {
            return false;
        }

        const fileContent = fs.readFileSync(versionFilePath, 'utf-8');
        const savedVersionInfo = JSON.parse(fileContent);
        const savedName = savedVersionInfo.version;

        if (savedName === latestName) {
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error('프론트엔드 버전 확인 중 오류 발생:', error.message);
        return false;
    }
}

/**
 * artifact 이름에서 타임스탬프를 추출해 한국식 날짜/시간 형식으로 반환
 * @param {string} artifactName - 예: frontend-export-20250803143751
 * @returns {string|null} 포맷된 시간 문자열 또는 null
 */
export function formatArtifactTimestamp(artifactName) {
    const match = artifactName.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/);

    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second] = match;

    const hourNum = parseInt(hour, 10);
    const isPM = hourNum >= 12;
    const displayHour = hourNum % 12 === 0 ? 12 : hourNum % 12;

    return `${year}년 ${parseInt(month, 10)}월 ${parseInt(day, 10)}일 ${isPM ? '오후' : '오전'} ${displayHour}시 ${minute}분 ${second}초`;
}

async function confirm(question, { defaultYes = false, timeoutMs = 3000 } = {}) {
    // CI나 비-TTY 터미널이면 질문하지 않음
    if (process.env.CI === 'true' || !output.isTTY) {
        return defaultYes;
    }

    const rl = readline.createInterface({ input, output });
    const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
    const q = `${question}${suffix}`;

    try {
        const answerPromise = rl.question(q);
        const timer = new Promise(resolve =>
            setTimeout(() => resolve(defaultYes ? 'y' : 'n'), timeoutMs)
        );

        const answerRaw = await Promise.race([answerPromise, timer]);
        const answer = String(answerRaw || '')
            .trim()
            .toLowerCase();

        return answer === 'y' || answer === 'yes';
    } finally {
        rl.close();
        output.write('\n');
    }
}

// 아티팩트 목록 선택 메서드
async function pickArtifactFromList(artifacts) {
    console.log('\n=== 다운로드할 아티팩트를 선택하세요 ===');
    artifacts.forEach((a, i) => {
        const created = new Date(a.created_at).toISOString().replace('T', ' ').slice(0, 19);
        console.log(`[${i}] ${a.name}  •  created: ${created}`);
    });
    const rl = readline.createInterface({ input, output });
    try {
        const answer = await rl.question('인덱스 입력 (취소: 엔터): ');
        const idx = Number(answer);
        if (!answer || Number.isNaN(idx) || idx < 0 || idx >= artifacts.length) {
            return null;
        }
        return artifacts[idx];
    } finally {
        rl.close();
    }
}
