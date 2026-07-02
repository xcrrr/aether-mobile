'use client';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/useReducedMotion';

/** Quiet once-only rise-in for section content. Renders inert when motion is reduced. */
export function Reveal({
  children,
  delay = 0,
  as = 'div',
}: {
  children: React.ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'article';
}) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  if (reduced) {
    const Plain = as;
    return <Plain>{children}</Plain>;
  }
  return (
    <Tag
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
}
