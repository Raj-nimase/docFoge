const Project = require('../models/Project');

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
    const { id: clientId, templateId, metadata, frontMatter, chapters, createdAt, updatedAt } = req.body;

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
        createdAt: createdAt || Date.now(),
        updatedAt: updatedAt || Date.now(),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, project: doc.toClientJSON() });
  } catch (err) {
    next(err);
  }
}

async function syncProjects(req, res, next) {
  try {
    const { projects } = req.body;
    if (!Array.isArray(projects)) {
      return res.status(400).json({ success: false, error: 'projects must be an array' });
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
            createdAt: p.createdAt || Date.now(),
            updatedAt: p.updatedAt || Date.now(),
          },
        },
        upsert: true,
      },
    }));

    if (ops.length > 0) {
      await Project.bulkWrite(ops);
    }

    const docs = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    res.json({ success: true, projects: docs.map(d => d.toClientJSON()) });
  } catch (err) {
    next(err);
  }
}

async function deleteProject(req, res, next) {
  try {
    const { clientId } = req.params;
    await Project.deleteOne({ userId: req.user._id, clientId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { listProjects, upsertProject, syncProjects, deleteProject };
