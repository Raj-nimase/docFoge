import {
  GraduationCap,
  FileText,
  BookOpen,
  FileCode,
  Files,
} from 'lucide-react';
import { TEMPLATES } from '@/utils/templates';

export const TEMPLATE_MAP = Object.freeze(
  TEMPLATES.reduce((acc, t) => {
    if (t && t.id) {
      acc[t.id] = t;
    }
    return acc;
  }, Object.create(null))
);

export function getTemplate(templateId) {
  if (typeof templateId !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(templateId)) {
    return null;
  }
  return TEMPLATE_MAP[templateId] || null;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function getTemplateIcon(iconStr, className = "") {
  const iconStyle = { color: 'var(--accent)' };
  switch (iconStr) {
    case '🎓':
      return <GraduationCap className={className} size={28} strokeWidth={1.8} style={iconStyle} />;
    case '📄':
      return <FileText className={className} size={28} strokeWidth={1.8} style={iconStyle} />;
    case '📚':
      return <BookOpen className={className} size={28} strokeWidth={1.8} style={iconStyle} />;
    case '📝':
      return <FileCode className={className} size={28} strokeWidth={1.8} style={iconStyle} />;
    case '📃':
      return <Files className={className} size={28} strokeWidth={1.8} style={iconStyle} />;
    default:
      return <FileText className={className} size={28} strokeWidth={1.8} style={iconStyle} />;
  }
}

export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

export const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
};
