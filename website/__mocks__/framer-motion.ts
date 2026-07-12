import React from 'react';

const MOTION_PROPS = new Set([
  'initial',
  'animate',
  'exit',
  'whileInView',
  'whileHover',
  'whileTap',
  'viewport',
  'transition',
  'variants',
  'layout',
]);

function stripMotionProps(props: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!MOTION_PROPS.has(key)) clean[key] = value;
  }
  return clean;
}

function createMotionComponent(tag: string) {
  const Component = React.forwardRef((props: Record<string, unknown>, ref) => {
    const clean = stripMotionProps(props);
    if (typeof ref === 'function' || (typeof ref === 'object' && ref !== null)) {
      clean.ref = ref;
    }
    return React.createElement(tag, clean);
  });
  Component.displayName = `MockMotion.${tag}`;
  return Component;
}

export const motion = {
  div: createMotionComponent('div'),
  section: createMotionComponent('section'),
  article: createMotionComponent('article'),
  header: createMotionComponent('header'),
  p: createMotionComponent('p'),
  h1: createMotionComponent('h1'),
  h2: createMotionComponent('h2'),
  h3: createMotionComponent('h3'),
  span: createMotionComponent('span'),
  g: createMotionComponent('g'),
  line: createMotionComponent('line'),
};

export const AnimatePresence = ({ children }: { children?: React.ReactNode }) =>
  React.createElement(React.Fragment, null, children);

export const easeOut = [0.22, 1, 0.36, 1];
export const useInView = () => true;
export const useScroll = () => ({ scrollYProgress: { get: () => 0, on: () => () => {} } });
export const useMotionValueEvent = () => undefined;
