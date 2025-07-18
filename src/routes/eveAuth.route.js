const express = require('express');
const router = express.Router();
const eveAuthController = require('../controllers/eveAuth.controller');

router.get('/login', eveAuthController.redirectToEveLogin);
router.get('/callback', eveAuthController.handleCallback);

module.exports = router;
