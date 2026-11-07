// One guard for whatever reloads the page: the reload screen's Reload, the rescue screen's Try
// again and Home's Update. While a reload would lose a value only memory holds, the first tap
// asks to Export, and the next reloads (screens/update-offer.ts, `onReloadTap`).

import { useState } from 'react';
import { onReloadTap, reloadLoses } from '../update-offer';
import { useSaveFeedback } from './feedback';

export function useReloadGuard(reload: () => void): {
  asking: boolean;
  unkept: boolean;
  tap: () => void;
} {
  const feedback = useSaveFeedback();
  const [asking, setAsking] = useState(false);
  return {
    asking,
    unkept: reloadLoses(feedback),
    tap: () => (onReloadTap(feedback, asking) === 'ask' ? setAsking(true) : reload()),
  };
}
