import { useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { MoveRight, Check, FileText } from 'lucide-react';
import DOMPurify from 'dompurify';
import useTypingLoop from './useTypingLoop';
import { demoBlockVariants, EASE } from '../../landingMotion';

function PreviewBlock({ block }) {
  const { render } = block;
  switch (render.type) {
    case 'h1':
      return (
        <div className="demo-a4-h1">
          {render.lines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      );
    case 'h2':
      return <div className="demo-a4-h2">{render.text}</div>;
    case 'math':
      return (
        <div className="demo-a4-math">
          {/* pre-rendered once at module load with throwOnError:false & sanitized with DOMPurify */}
          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(render.html) }} />
          <span className="demo-a4-eqnum">{render.eqNumber}</span>
        </div>
      );
    case 'table':
      return (
        <div className="demo-a4-tablewrap">
          <div className="demo-a4-caption">{render.caption}</div>
          <table className="demo-a4-table">
            <thead>
              <tr>
                {render.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {render.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => (
                    <td key={i}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p className="demo-a4-p">{render.text}</p>;
  }
}

/**
 * The automated hero demo: raw text types on the left, the formatted
 * A4 page assembles itself on the right, loops through samples.
 */
export default function HeroDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.3 });
  const { sample, typedText, visibleBlockCount, phase } = useTypingLoop(inView);

  const fading = phase === 'fade';

  return (
    <div className="hero-demo" ref={ref}>
      {/* window chrome */}
      <div className="hero-demo-chrome">
        <span className="hero-demo-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
        <span className="hero-demo-tab">
          <FileText size={12} aria-hidden />
          {sample.file}
          <MoveRight size={12} className="hero-demo-tab-arrow" aria-hidden />
          thesis.pdf
        </span>
      </div>

      <div className="hero-demo-panes">
        {/* left: raw text being typed */}
        <motion.div
          className="hero-demo-editor"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="hero-demo-editor-label">Your draft</div>
          <pre className="hero-demo-raw">
            {typedText}
            <span className="demo-caret" aria-hidden />
          </pre>
        </motion.div>

        <div className="hero-demo-divider" aria-hidden>
          <MoveRight size={18} strokeWidth={2.2} />
        </div>

        {/* right: mini A4 page assembling itself */}
        <motion.div
          className="hero-demo-preview"
          animate={{ opacity: fading ? 0 : 1 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <div className="hero-demo-editor-label">Formatted page</div>
          <div className="demo-a4" key={sample.id}>
            {sample.blocks.slice(0, visibleBlockCount).map((block, i) => (
              <motion.div
                key={`${sample.id}-${i}`}
                variants={demoBlockVariants}
                initial="hidden"
                animate="show"
              >
                <PreviewBlock block={block} />
              </motion.div>
            ))}
          </div>
          <motion.span
            className="hero-demo-compiled"
            initial={{ opacity: 0, scale: 0.8, y: 6 }}
            animate={
              phase === 'hold'
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 0, scale: 0.8, y: 6 }
            }
            transition={{ duration: 0.3, ease: EASE }}
          >
            <Check size={12} strokeWidth={3} /> Compiled
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}
