const { getAccessTokenAndCharacter } = require('../service/eveAuth.service');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

exports.redirectToEveLogin = (req, res) => {
  const { CLIENT_ID, REDIRECT_URI } = process.env;
  const scope = 'publicData';
  const authorizeUrl = `https://login.eveonline.com/v2/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_id=${CLIENT_ID}&scope=${scope}`;
  res.redirect(authorizeUrl);
};

exports.handleCallback = async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('코드 없음');

  try {
    const character = await getAccessTokenAndCharacter(code);

    // JWT 토큰 생성
    const token = jwt.sign({
      CharacterID: character.CharacterID,
      CharacterName: character.CharacterName,
    }, JWT_SECRET, { expiresIn: '1h' });

    // 토큰 응답 (예: 쿠키 또는 JSON으로 전송)
    res.send(`
      <h2>${character.CharacterName}님 환영합니다!</h2>
      <p>이 토큰을 API 요청 시 Authorization 헤더에 사용하세요:</p>
      <code>Bearer ${token}</code>
    `);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('로그인 실패');
  }
};
