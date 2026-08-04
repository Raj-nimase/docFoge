import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ClipboardPaste,
  WandSparkles,
  BookOpen,
  FileCheck,
  Sigma,
  CloudUpload,
} from 'lucide-react';
import { SketchDocument } from '@/components/SketchDecor/SketchDecor';
import {
  revealVariants,
  revealViewport,
  cardStaggerVariants,
  cardVariants,
  hoverLift,
} from '../../landingMotion';

const FEATURES = [
  {
    icon: ClipboardPaste,
    title: 'Paste anything',
    desc: 'Word documents, Markdown notes, raw LaTeX — drop them in and Acadoc understands the structure instantly.',
    tall: true,
  },
  {
    icon: WandSparkles,
    title: 'Auto-formatting',
    desc: 'Headings, spacing, numbering and citations aligned to university standards — without touching a style menu.',
  },
  {
    icon: BookOpen,
    title: 'Chapter management',
    desc: 'Split, merge and reorder chapters freely. Your document stays one coherent thesis.',
  },
  {
    icon: FileCheck,
    title: 'One-click PDF',
    desc: 'A live preview of your final pages, and a bound, submission-ready PDF whenever you want it.',
    tall: true,
  },
  {
    icon: Sigma,
    title: 'Math & tables',
    desc: 'Equations render beautifully with KaTeX; tables come out clean and academic.',
  },
  {
    icon: CloudUpload,
    title: 'Cloud sync',
    desc: 'Your projects follow you across devices, safely stored in your account.',
  },
];

/**
 * Sticky left column + asymmetric bento feature grid.
 */
export default function FeaturesSection() {
  const navigate = useNavigate();

  return (
    <section className="landing-features" id="features">
      <motion.div
        className="landing-features-intro"
        variants={revealVariants}
        initial="hidden"
        whileInView="show"
        viewport={revealViewport}
      >
        <span className="landing-eyebrow">Why Acadoc</span>
        <h2 className="landing-h2">
          Everything between your draft and a bound PDF
        </h2>
        <p className="landing-body">
          Formatting a thesis steals weeks from actual research. Acadoc reads
          whatever you paste, rebuilds it into a properly structured academic
          document, and keeps it compilable to a clean PDF at every step.
        </p>
        <button
          type="button"
          className="btn-primary landing-features-cta"
          onClick={() => navigate('/auth')}
        >
          Start writing
        </button>
      </motion.div>

      <motion.div
        className="landing-features-grid"
        variants={cardStaggerVariants}
        initial="hidden"
        whileInView="show"
        viewport={revealViewport}
      >
        {FEATURES.map(({ icon: Icon, title, desc, tall }) => (
          <motion.article
            key={title}
            className={`landing-feature-card ${tall ? 'landing-feature-card--tall' : ''}`}
            variants={cardVariants}
            whileHover={hoverLift}
          >
            <span className="landing-feature-icon">
              <Icon size={20} strokeWidth={2} aria-hidden />
            </span>
            <h3 className="landing-feature-title">{title}</h3>
            <p className="landing-feature-desc">{desc}</p>
            {tall && (
              <div className="landing-feature-art" aria-hidden>
                <SketchDocument size={72} />
              </div>
            )}
          </motion.article>
        ))}
      </motion.div>
    </section>
  );
}
