const express = require('express');
const {
  listProjects,
  getSyncStatus,
  getProject,
  upsertProject,
  syncProjects,
  deleteProject,
} = require('../controllers/projectController');
const { requireAuth } = require('../middleware/auth');
const { smallJsonGuard } = require('../middleware/requestSizeGuard');

const router = express.Router();

router.use(requireAuth);

router.get('/', listProjects);
router.get('/sync-status', getSyncStatus);
router.get('/:clientId', getProject);
router.put('/sync/all', syncProjects);                    // global 5 MB — used for login merge of all projects
router.put('/item', smallJsonGuard, upsertProject);       // 2 MB — single project, no images in body
router.delete('/:clientId', deleteProject);

module.exports = router;
