export function normalizeExt(fileType, fileName) {
    //확장자가 애매하게 나오는 경우 S3에서 불러와지지 않기에 정규화 해 줘야함
    //그리고 미리 허용 목록을 만들어서 그 목록 안의 파일만 가져오는게 좋다고 함
}

/**
 * ex
 * const ALLOWED_MIME = new Set([
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  // videos
  "video/mp4",
  "video/webm",
  "video/quicktime", // mov
]);
const MIME_TO_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",

  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

 * 
 * 
 */
