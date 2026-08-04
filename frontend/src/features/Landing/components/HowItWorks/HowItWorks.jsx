import { motion } from 'motion/react';
import {
  revealVariants,
  revealViewport,
  cardStaggerVariants,
  cardVariants,
} from '../../landingMotion';

const STEPS = [
  {
    num: '01',
    title: 'Paste your draft',
    desc: 'Bring text from Word, Google Docs, Markdown or LaTeX. Chapters, headings and math are detected automatically.',
  },
  {
    num: '02',
    title: 'Review the structure',
    desc: 'Acadoc arranges everything into numbered chapters on clean A4 pages. Adjust anything in a calm, focused editor.',
  },
  {
    num: '03',
    title: 'Compile to PDF',
    desc: 'One click produces a submission-ready PDF — title page, table of contents and all.',
  },
];

/** Three-step "how it works" strip. */
export default function HowItWorks() {
  return (
    <section className="landing-how" id="how">
      <motion.div
        className="landing-how-header"
        variants={revealVariants}
        initial="hidden"
        whileInView="show"
        viewport={revealViewport}
      >
        <span className="landing-eyebrow">How it works</span>
        <h2 className="landing-h2">From paste to PDF in three steps</h2>
      </motion.div>

      <motion.div
        className="landing-how-grid"
        variants={cardStaggerVariants}
        initial="hidden"
        whileInView="show"
        viewport={revealViewport}
      >
        {STEPS.map(({ num, title, desc }) => (
          <motion.div key={num} className="landing-how-step" variants={cardVariants}>
            <span className="landing-how-num" aria-hidden>{num}</span>
            <h3 className="landing-how-title">{title}</h3>
            <p className="landing-how-desc">{desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
