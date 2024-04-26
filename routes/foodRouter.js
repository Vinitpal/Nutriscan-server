const express = require('express');
const router = express.Router();

const { getDetails } = require('../controllers/foodController');

router.post('/details', getDetails);

module.exports = router;
