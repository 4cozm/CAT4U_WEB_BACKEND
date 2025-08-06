import { ALLOWED_CORP_ID, ALLOWED_EDIT_ROLE, ALLOWED_WRITE_ROLE } from '../config/serverConfig.js';
/**
 * ESI로 가져온 title(Role)을 가공해서 문자열로 반환
 * @param {*} rawTitleArr <color=0xffFFD228><b>새끼 고양이</color></b>
 * @returns "새끼 고양이, 고양이"
 */
export function extractTags(rawTitleArr) {
    if (!Array.isArray(rawTitleArr)) {
        return '';
    }
    return rawTitleArr
        .map(t =>
            typeof t === 'string'
                ? t.replace(/<[^>]+>/g, '').trim()
                : t.name
                  ? t.name.replace(/<[^>]+>/g, '').trim()
                  : ''
        )
        .filter(Boolean) // 빈 값 제거
        .join(', ');
}

/**
 * 글쓰기 댓글이 가능한 권한인지 확인하는 유틸 메서드
 * 입력 문자열(쉼표구분) → 배열 변환 → 허용리스트와 비교
 * @param {string} inputStr "새끼 고양이, 고양이"
 * @returns {boolean}
 */
export function isAllowedWriteRole(inputStr) {
    if (!inputStr) {
        return false;
    }
    const titles = inputStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    return titles.some(title => ALLOWED_WRITE_ROLE.includes(title));
}

/**
 * 글 수정/삭제가 가능한 권한인지 확인하는 유틸 메서드
 * 입력 문자열(쉼표구분) → 배열 변환 → 허용리스트와 비교
 * @param {string} inputStr "새끼 고양이, 고양이"
 * @returns {boolean}
 */
export function isAllowedEditRole(inputStr) {
    if (!inputStr) {
        return false;
    }
    const titles = inputStr
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    return titles.some(title => ALLOWED_EDIT_ROLE.includes(title));
}

/**
 *  * 허용된 코퍼레이션인지 확인하는 유틸 메서드
 * @param {string} corpId
 * @returns {boolean}
 */
export function isAllowedCorp(corpId) {
    if (!corpId) {
        return false;
    }
    return ALLOWED_CORP_ID.includes(corpId);
}
