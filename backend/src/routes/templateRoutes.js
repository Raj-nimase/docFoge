/**
 * AcaDoc Templates Route
 * GET /api/templates — returns all available template definitions
 */
const express = require('express');
const { TEMPLATES } = require('../data/templates');
const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ success: true, templates: TEMPLATES });
});

router.get('/:id', (req, res) => {
  const tpl = TEMPLATES.find(t => t.id === req.params.id);
  if (!tpl) return res.status(404).json({ success: false, error: 'Template not found' });
  res.json({ success: true, template: tpl });
});

module.exports = router;
