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
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
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

    // Log incoming payload size and count to help diagnose slow syncs
    try {
      const payloadSize = JSON.stringify(req.body).length;
      console.log('[syncProjects] received', `projects=${projects.length}`, `bytes=${payloadSize}`);
    } catch (e) {
      console.log('[syncProjects] received', `projects=${projects.length}`);
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
      console.time('[syncProjects] bulkWrite');
      await Project.bulkWrite(ops);
      console.timeEnd('[syncProjects] bulkWrite');
    }

    console.time('[syncProjects] find');
    const docs = await Project.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    console.timeEnd('[syncProjects] find');

    console.log('[syncProjects] returning', `projects=${docs.length}`);
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
