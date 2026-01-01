/**상위 함수로 던지기 위한 에러 */

export function rethrow(err) {
    if (err instanceof Error) {
        throw err;
    }
    throw new Error(String(err));
}
