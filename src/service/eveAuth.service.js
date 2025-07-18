require('dotenv').config();
const axios = require('axios');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;

exports.getAuthUrl = () => {
  return `https://login.eveonline.com/v2/oauth/authorize?response_type=code&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&client_id=${CLIENT_ID}&scope=publicData`;
};

exports.processCallback = async (code) => {
  if (!code) throw new Error('코드가 없습니다');

  const tokenRes = await axios.post('https://login.eveonline.com/v2/oauth/token', new URLSearchParams({
    grant_type: 'authorization_code',
    code,
  }), {
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const access_token = tokenRes.data.access_token;

  const charRes = await axios.get('https://login.eveonline.com/oauth/verify', {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });

  return charRes.data;
};
