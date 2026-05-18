const express = require('express');
const {
  listProjects,
  upsertProject,
  syncProjects,
  deleteProject,
} = require('../controllers/projectController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', listProjects);
router.put('/sync/all', syncProjects);
router.put('/item', upsertProject);
router.delete('/:clientId', deleteProject);

module.exports = router;
