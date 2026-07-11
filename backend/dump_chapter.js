const mongoose = require('mongoose');

async function main() {
  const uri = "mongodb+srv://rajnimase163:rajkkc@cluster0.8jh0kpq.mongodb.net/acadoc?appName=Cluster0";
  
  try {
    await mongoose.connect(uri);
    
    // Find the latest project
    const ProjectSchema = new mongoose.Schema({}, { strict: false });
    const Project = mongoose.model('Project', ProjectSchema);
    
    const latestProject = await Project.findOne().sort({ updatedAt: -1 }).lean();
    if (!latestProject) {
      console.log("No projects found.");
      return;
    }
    
    console.log("Project Title:", latestProject.title);
    console.log("Number of chapters:", latestProject.chapters?.length);
    
    for (const chapter of latestProject.chapters || []) {
      if (chapter.title.toLowerCase().includes('introduction') || JSON.stringify(chapter.content).toLowerCase().includes('algebra')) {
        console.log("\n========================================");
        console.log("Chapter ID:", chapter.id);
        console.log("Chapter Title:", chapter.title);
        console.log("JSON Content (First 15 nodes):");
        if (chapter.content && Array.isArray(chapter.content.content)) {
          console.log(JSON.stringify(chapter.content.content.slice(0, 15), null, 2));
        } else {
          console.log("No content array");
        }
        console.log("========================================");
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    await mongoose.connection.close();
  }
}

main();
