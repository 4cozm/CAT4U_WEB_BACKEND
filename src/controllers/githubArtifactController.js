import { fetchArtifacts, getLatestArtifact } from '../service/githubArtifactService.js';

//service에 있는 기능들을 조합하여 컨트롤러 완성
export async function downloadLatestArtifact(req, res) {
    try {
        const artifacts = await fetchArtifacts(
            '4cozm',
            'CAT4U_WEB_FRONTEND',
            process.env.WEB_ARTIFACT_TOKEN
        );
        const latest = getLatestArtifact(artifacts);

        if (!latest) {
            return res.status(404).json({ message: '최신 아티펙트 파일이 존재하지 않습니다.' });
        }

        res.json(latest);
    } catch (error) {
        res.status(500).json({
            message: '최신 아티펙트를 가져오는데 실패했습니다',
            error: error.message,
        });
    }
}
