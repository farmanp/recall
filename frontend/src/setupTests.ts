import '@testing-library/jest-dom';
import React from 'react';
import { vi } from 'vitest';

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    // noop for tests
  };
}

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<typeof import('framer-motion')>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) =>
          React.forwardRef(({ children, ...rest }: any, ref: any) => {
            const {
              layout,
              layoutId,
              animate,
              initial,
              exit,
              variants,
              transition,
              whileHover,
              whileTap,
              whileInView,
              viewport,
              ...domProps
            } = rest;
            return React.createElement(prop, { ref, ...domProps }, children);
          }),
      }
    ),
  };
});
