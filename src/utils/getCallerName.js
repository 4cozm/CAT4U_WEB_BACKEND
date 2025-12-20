//코드를 불러온 함수를 반환하는 유틸함수

export default function getCallerName(offset = 2) {
    // offset: 2 = 즉시 호출한 상위 함수 (기본값)
    const err = new Error();
    const stackLines = err.stack?.split("\n") || [];
    // 예외: offset이 범위 초과시 unknown
    const callerLine = stackLines[offset] || "";
    const match = callerLine.match(/at (\w+) /);
    return match ? match[1] : "unknown";
}
