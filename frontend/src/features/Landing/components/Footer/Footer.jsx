import { useNavigate } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

/** Minimal landing footer. */
export default function Footer() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer className="landing-footer">
      <div className="landing-footer-brand">
        <GraduationCap size={18} strokeWidth={2.2} aria-hidden />
        <span>Acadoc</span>
      </div>
      <p className="landing-footer-tagline">Structured writing for serious research.</p>
      <div className="landing-footer-meta">
        <button type="button" className="landing-footer-link" onClick={() => navigate('/auth')}>
          Sign in
        </button>
        <span>© {year} Acadoc</span>
      </div>
    </footer>
  );
}
