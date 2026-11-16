import { createCn } from 'cn/config';

/**
 * Join class names, letting a later Tailwind class override an earlier one (shadcn's `cn`). It
 * knows the app's own type sizes and fill corners (app.css `@theme`), so `text-sub` followed by
 * a colour keeps its size, and `rounded-fill` gives way to a later radius, and the reverse.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: ['caption', 'sub', 'body', 'title', 'heading', 'display'],
      radius: ['fill'],
    },
  },
});
