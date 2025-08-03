import ora from 'ora';
import {
    downloadArtifact,
    extractArtifact,
    findLatestArtifact,
    getAllArtifacts,
    saveFrontendVersion,
} from '../service/githubArtifactService.js';

export async function downloadLatestArtifact(req, res) {
    const spinner = ora('아티팩트 다운로드 요청 접수! 다운로드 준비 중...').start();

    try {
        // 1️⃣ 아티팩트 목록 조회
        spinner.text = 'GitHub 아티팩트 목록 조회 중...';
        const artifacts = await getAllArtifacts(
            '4cozm',
            'CAT4U_WEB_FRONTEND',
            process.env.WEB_ARTIFACT_TOKEN
        );

        const latest = findLatestArtifact(artifacts);
        if (!latest) {
            spinner.fail('최신 아티팩트가 존재하지 않습니다.');
            return res.status(404).json({ message: '최신 아티팩트가 존재하지 않습니다.' });
        }
        spinner.succeed(`최신 아티팩트 확인 완료: ${latest.name}`);

        // 2️⃣ ZIP 다운로드
        spinner.start(`📦 아티팩트 다운로드 중: ${latest.name}`);
        const zipPath = await downloadArtifact(latest);
        if (!zipPath) {
            spinner.fail('ZIP 다운로드 실패');
            return res.status(500).json({ message: 'ZIP 다운로드 실패' });
        }
        spinner.succeed('ZIP 다운로드 완료');

        // 3️⃣ 압축 해제
        spinner.start('ZIP 압축 해제 중...');
        const success = await extractArtifact(zipPath);
        if (!success) {
            spinner.fail('압축 해제 실패');
            return res.status(500).json({ message: '압축 해제 실패' });
        }
        spinner.succeed('압축 해제 완료');

        // 4️⃣ 버전 정보 저장
        spinner.start('버전 정보 저장 중...');
        saveFrontendVersion(latest.name);
        spinner.succeed('버전 정보 저장 완료');

        spinner.succeed('아티팩트 다운로드 및 배포 완료');
        return res.status(200).json({
            message: '아티팩트 다운로드 및 배포 완료',
            deployedVersion: latest.name,
        });
    } catch (error) {
        spinner.fail('아티팩트 다운로드 중 오류 발생');
        console.error('아티팩트 다운로드 중 오류:', error);
        return res.status(500).json({
            message: '아티팩트 다운로드 중 오류 발생',
            error: error.message,
        });
    }
}
