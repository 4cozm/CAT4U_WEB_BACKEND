import axios from 'axios';

//기능정의
export async function fetchArtifacts(owner, repo, token) {
    //아티펙트 조회
    const url = `https://api.github.com/repos/${owner}/${repo}/actions/artifacts`;
    const response = await axios.get(url, {
        headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
        },
    });

    return response.data.artifacts;
}

export function getLatestArtifact(artifacts) {
    if (!artifacts.length) {
        return null;
    }
    return artifacts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

export async function downloadLatestArtifactOnStartup() {
    try {
        const artifacts = await fetchArtifacts(
            '4cozm',
            'CAT4U_WEB_FRONTEND',
            process.env.WEB_ARTIFACT_TOKEN
        );
        const latest = getLatestArtifact(artifacts);

        if (!latest) {
            console.error('최신 웹 정적 파일이 존재하지 않습니다');
            // Logger.warn('최신 웹 정적 파일이 존재하지 않습니다');
            return null;
        }
        console.log(`최신 웹 정적 파일 찾음!: ${latest.name}`);
        // Logger.info(`최신 웹 정적 파일 찾음!: ${latest.name}`);
        return latest;
    } catch (e) {
        console.error('서버 시작중 웹 정적 파일 다운로드 시도가 실패했습니다. :', e.message);
        // Logger.warn('서버 시작중 웹 정적 파일 다운로드 시도가 실패했습니다. :', e.message);
        return null;
    }
}
