const Project = require('../models/Project');
const { deleteProjectImages } = require('../services/storageService');

async function listProjects(req, res, next) {
  try {
    const docs = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, projects: docs.map(d => d.toClientJSON()) });
  } catch (err) {
    next(err);
  }
}

async function upsertProject(req, res, next) {
  try {
    const { id: clientId, templateId, metadata, frontMatter, chapters, isPinned, pinned, deletedAt, createdAt, updatedAt } = req.body;

    if (!clientId || !templateId) {
      return res.status(400).json({ success: false, error: 'Project id and templateId are required' });
    }

    const doc = await Project.findOneAndUpdate(
      { userId: req.user._id, clientId },
      {
        userId: req.user._id,
        clientId,
        templateId,
        metadata: metadata || {},
        frontMatter: frontMatter || [],
        chapters: chapters || [],
        isPinned: !!(isPinned || pinned),
        deletedAt: deletedAt || null,
        createdAt: createdAt || Date.now(),
        updatedAt: updatedAt || Date.now(),
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, project: doc.toClientJSON() });
  } catch (err) {
    next(err);
  }
}

async function syncProjects(req, res, next) {
  try {
    const { projects = [], deleteIds = [] } = req.body;
    if (!Array.isArray(projects) || !Array.isArray(deleteIds)) {
      return res.status(400).json({ success: false, error: 'projects and deleteIds must be arrays' });
    }

    // Log incoming batch payload size and count
    try {
      const payloadSize = JSON.stringify(req.body).length;
      console.log('[syncProjects] received batch', `upserts=${projects.length}`, `deletes=${deleteIds.length}`, `bytes=${payloadSize}`);
    } catch (e) {
      console.log('[syncProjects] received batch', `upserts=${projects.length}`, `deletes=${deleteIds.length}`);
    }

    const ops = projects.map(p => ({
      updateOne: {
        filter: { userId: req.user._id, clientId: p.id },
        update: {
          $set: {
            userId: req.user._id,
            clientId: p.id,
            templateId: p.templateId,
            metadata: p.metadata || {},
            frontMatter: p.frontMatter || [],
            chapters: p.chapters || [],
            isPinned: !!(p.isPinned || p.pinned),
            deletedAt: p.deletedAt || null,
            createdAt: p.createdAt || Date.now(),
            updatedAt: p.updatedAt || Date.now(),
          },
        },
        upsert: true,
      },
    }));

    // Add bulk delete operations to the same bulkWrite batch!
    if (deleteIds.length > 0) {
      ops.push({
        deleteMany: {
          filter: { userId: req.user._id, clientId: { $in: deleteIds } }
        }
      });
      deleteIds.forEach((pId) => {
        deleteProjectImages(req.user._id.toString(), pId).catch((err) =>
          console.warn(`[syncProjects] Cloudinary cleanup failed for ${pId}:`, err.message)
        );
      });
    }

    if (ops.length > 0) {
      console.time('[syncProjects] bulkWrite');
      await Project.bulkWrite(ops);
      console.timeEnd('[syncProjects] bulkWrite');
    }

    const docs = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, projects: docs.map(d => d.toClientJSON()) });
  } catch (err) {
    next(err);
  }
}

async function getSyncStatus(req, res, next) {
  try {
    const docs = await Project.find({ userId: req.user._id }, { clientId: 1, updatedAt: 1, deletedAt: 1 });
    res.json({
      success: true,
      syncStatus: docs.map(d => ({
        id: d.clientId,
        updatedAt: d.updatedAt || 0,
        deletedAt: d.deletedAt || null,
      }))
    });
  } catch (err) {
    next(err);
  }
}

async function getProject(req, res, next) {
  try {
    const { clientId } = req.params;
    const doc = await Project.findOne({ userId: req.user._id, clientId });
    if (!doc) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }
    res.json({ success: true, project: doc.toClientJSON() });
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { clientId } = req.params;
    await Project.deleteOne({ userId: req.user._id, clientId });
    deleteProjectImages(req.user._id.toString(), clientId).catch((err) =>
      console.warn(`[deleteProject] Cloudinary cleanup failed for ${clientId}:`, err.message)
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProjects, getSyncStatus, getProject, upsertProject, syncProjects, deleteProject };
