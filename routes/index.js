var express = require('express');
var router = express.Router();

var db = require('../queries');


router.get('/events', db.getEvents);
router.get('/event/:id', db.getEvent);

router.get('/daysevents', db.getDaysEvents);
router.get('/countevents', db.getCountEvents);

module.exports = router;