import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// A placeholder shell. The routes and screens arrive in T032.
function Shell() {
  return (
    <main>
      <h1>Carnatic Wrapped</h1>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <Shell />
  </StrictMode>,
);
