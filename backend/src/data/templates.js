/**
 * AcaDoc Template Definitions
 *
 * Each template defines the structure of a document:
 * - metadata fields (title, author, institution, etc.)
 * - front matter sections (auto-generated pages)
 * - pre-populated chapter list
 */

const TEMPLATES = [
  {
    id: 'diploma-project-report',
    name: 'Diploma Project Report',
    description: 'MSBTE-style professional project report with title page, certificate, acknowledgement, abstract, TOC, and numbered chapters.',
    icon: '🎓',
    metadataFields: [
      { key: 'title',       label: 'Project Title',    type: 'text',     required: true  },
      { key: 'authors',     label: 'Authors',           type: 'textarea', required: true  },
      { key: 'guide',       label: 'Project Guide',     type: 'text',     required: false },
      { key: 'department',  label: 'Department',        type: 'text',     required: false },
      { key: 'institution', label: 'Institution Name',  type: 'text',     required: false },
      { key: 'year',        label: 'Academic Year',     type: 'text',     required: false },
    ],
    frontMatter: [
      { id: 'title_page',      label: 'Title Page',        auto: true  },
      { id: 'certificate',     label: 'Certificate',       auto: false },
      { id: 'acknowledgement', label: 'Acknowledgement',   auto: false },
      { id: 'abstract',        label: 'Abstract',          auto: false },
      { id: 'toc',             label: 'Table of Contents', auto: true  },
    ],
    chapters: [
      { id: 'ch1', title: 'Introduction',                  required: true  },
      { id: 'ch2', title: 'Literature Survey',             required: true  },
      { id: 'ch3', title: 'Scope of Project',              required: false },
      { id: 'ch4', title: 'Proposed Methodology',          required: false },
      { id: 'ch5', title: 'System Design',                 required: false },
      { id: 'ch6', title: 'Testing and Results',           required: false },
      { id: 'ch7', title: 'Conclusion and Future Scope',   required: false },
      { id: 'ch8', title: 'References',                    required: true  },
    ],
  },
  {
    id: 'ieee-paper',
    name: 'IEEE Research Paper',
    description: 'IEEE conference/journal style — two-column layout, abstract, keywords, numbered sections.',
    icon: '📄',
    metadataFields: [
      { key: 'title',    label: 'Paper Title',   type: 'text',     required: true  },
      { key: 'authors',  label: 'Authors',        type: 'textarea', required: true  },
      { key: 'abstract', label: 'Abstract',       type: 'textarea', required: true  },
      { key: 'keywords', label: 'Keywords',       type: 'text',     required: false },
    ],
    frontMatter: [],
    chapters: [
      { id: 'ch1', title: 'Introduction',        required: true  },
      { id: 'ch2', title: 'Related Work',         required: false },
      { id: 'ch3', title: 'Methodology',          required: true  },
      { id: 'ch4', title: 'Results and Discussion', required: false },
      { id: 'ch5', title: 'Conclusion',           required: true  },
      { id: 'ch6', title: 'References',           required: true  },
    ],
  },
  {
    id: 'thesis',
    name: 'B.Tech / B.E. Thesis',
    description: 'Full thesis format with declaration, synopsis, detailed chapters and bibliography.',
    icon: '📚',
    metadataFields: [
      { key: 'title',       label: 'Thesis Title',     type: 'text',     required: true  },
      { key: 'authors',     label: 'Author',            type: 'text',     required: true  },
      { key: 'guide',       label: 'Thesis Supervisor', type: 'text',     required: false },
      { key: 'department',  label: 'Department',        type: 'text',     required: false },
      { key: 'institution', label: 'University',        type: 'text',     required: false },
      { key: 'year',        label: 'Year',              type: 'text',     required: false },
    ],
    frontMatter: [
      { id: 'title_page',   label: 'Title Page',          auto: true  },
      { id: 'declaration',  label: 'Declaration',         auto: false },
      { id: 'abstract',     label: 'Abstract / Synopsis', auto: false },
      { id: 'toc',          label: 'Table of Contents',   auto: true  },
    ],
    chapters: [
      { id: 'ch1', title: 'Introduction',                required: true  },
      { id: 'ch2', title: 'Literature Review',           required: true  },
      { id: 'ch3', title: 'Research Methodology',        required: true  },
      { id: 'ch4', title: 'Implementation',              required: false },
      { id: 'ch5', title: 'Results and Analysis',        required: false },
      { id: 'ch6', title: 'Conclusion and Future Work',  required: true  },
      { id: 'ch7', title: 'Bibliography',                required: true  },
    ],
  },
  {
    id: 'assignment',
    name: 'Assignment',
    description: 'Clean, simple single-column assignment format for college submissions.',
    icon: '📝',
    metadataFields: [
      { key: 'title',       label: 'Assignment Title', type: 'text', required: true  },
      { key: 'authors',     label: 'Student Name',     type: 'text', required: true  },
      { key: 'department',  label: 'Subject',          type: 'text', required: false },
      { key: 'institution', label: 'Institution',      type: 'text', required: false },
      { key: 'year',        label: 'Roll No. / Date',  type: 'text', required: false },
    ],
    frontMatter: [
      { id: 'title_page', label: 'Title Page', auto: true },
    ],
    chapters: [
      { id: 'ch1', title: 'Problem Statement',   required: true  },
      { id: 'ch2', title: 'Solution / Approach', required: true  },
      { id: 'ch3', title: 'Conclusion',          required: false },
    ],
  },
  {
    id: 'blank',
    name: 'Blank Document',
    description: 'Start from scratch. No front matter, no pre-set chapters — a clean slate.',
    icon: '📃',
    metadataFields: [
      { key: 'title',   label: 'Document Title', type: 'text', required: true  },
      { key: 'authors', label: 'Author',          type: 'text', required: false },
      { key: 'year',    label: 'Date',            type: 'text', required: false },
    ],
    frontMatter: [],
    chapters: [
      { id: 'ch1', title: 'Chapter 1', required: true },
    ],
  },
];

module.exports = { TEMPLATES };
