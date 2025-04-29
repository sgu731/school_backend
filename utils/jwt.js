const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your_secret_key'; // 你可以自訂這個密鑰

function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, SECRET_KEY, { expiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET_KEY);
}

module.exports = { generateToken, verifyToken };
