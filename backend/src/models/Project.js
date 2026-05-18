const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientId: {
      type: String,
      required: true,
    },
    templateId: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    frontMatter: { type: [mongoose.Schema.Types.Mixed], default: [] },
    chapters: { type: [mongoose.Schema.Types.Mixed], default: [] },
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  },
  { timestamps: false }
);

projectSchema.index({ userId: 1, clientId: 1 }, { unique: true });

projectSchema.methods.toClientJSON = function toClientJSON() {
  return {
    id: this.clientId,
    templateId: this.templateId,
    metadata: this.metadata,
    frontMatter: this.frontMatter,
    chapters: this.chapters,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

module.exports = mongoose.model('Project', projectSchema);
