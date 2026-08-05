const express = require("express");
const router = express.Router();
const { formatSection } = require("../controllers/formatController");
const { requireAuth } = require("../middleware/auth");

router.use(requireAuth);

// POST /api/format/section
router.post("/section", formatSection);

module.exports = router;

