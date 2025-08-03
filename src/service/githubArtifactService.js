import axios from 'axios';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import unzipper from 'unzipper';

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
 * 가장 최신 아티팩트를 반환합니다.
 * @param {Array} artifacts - 아티팩트 배열
 * @returns {Object|null} 최신 아티팩트 객체
 */
export function findLatestArtifact(artifacts) {
    if (!artifacts.length) {
        return null;
    }
    return artifacts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

export async function deployFrontendOnStartup() {
    const spinner = ora('최신 아티팩트 다운로드 준비 중...').start();

    try {
        const artifacts = await getAllArtifacts(OWNER, REPO, process.env.WEB_ARTIFACT_TOKEN);
        const latest = findLatestArtifact(artifacts);

        if (isFrontendUpToDate(latest.name)) {
            spinner.succeed(
                `프론트 아티펙트가 이미 최신입니다!  버전:${formatArtifactTimestamp(latest.name)} 업데이트는 건너뛸게요🐰`,
                latest.name
            );
            return null;
        }

        const zipPath = await downloadArtifact(latest);
        if (!zipPath) {
            spinner.fail('ZIP 다운로드 실패');
            return null;
        }

        const success = await extractArtifact(zipPath);
        if (!success) {
            spinner.fail('압축 해제 실패');
            return null;
        }
        saveFrontendVersion(latest.name);
        spinner.succeed(
            '최신 아티팩트 다운로드 및 배포 완료 :' + formatArtifactTimestamp(latest.name)
        );
        return true;
    } catch (e) {
        spinner.fail('서버 시작 중 아티팩트 다운로드 실패');
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
        spinner.text = `📦 최신 아티팩트 다운로드 중: ${latest.name}`;
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
            console.log(`프론트엔드 업데이트 필요. (저장된: ${savedName}, 최신: ${latestName})`);
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
