const express = require("express");
const router = express.Router();
const { formatSection } = require("../controllers/formatController");

// POST /api/format/section
router.post("/section", formatSection);

module.exports = router;
