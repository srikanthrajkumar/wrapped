import { Link, Route, Switch, useLocation, useRoute } from 'wouter';
import { updateNow, useUpdateAvailable } from './pwa';
import { Placeholder } from './screens/Placeholder';

// Navigation per plan.md DD1: three bottom tabs (Season, Wrapped, Settings). Event and Item
// open as pushed screens; the tab bar hides while the Item editor is open. Tidy is reached
// from Season, and the Maintainer's /admin from Settings.

const ITEM_ROUTE = '/event/:eventId/item/:itemId';

const TABS = [
  {
    href: '/',
    label: 'Season',
    owns: (path: string) => !/^\/(wrapped|settings|admin)\b/.test(path),
  },
  { href: '/wrapped', label: 'Wrapped', owns: (path: string) => path.startsWith('/wrapped') },
  {
    href: '/settings',
    label: 'Settings',
    owns: (path: string) => /^\/(settings|admin)\b/.test(path),
  },
];

function TabBar() {
  const [path] = useLocation();
  return (
    <nav className="tabs" aria-label="Main">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={tab.owns(path) ? 'page' : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

function UpdateBar() {
  const available = useUpdateAvailable();
  // The status region is always present, so a screen reader announces the message when it
  // appears; a region inserted already filled is often missed.
  return (
    <div role="status">
      {available && (
        <div className="update-bar">
          <span>A new version is ready.</span>
          <button type="button" onClick={updateNow}>
            Update
          </button>
        </div>
      )}
    </div>
  );
}

export function App() {
  const [inItemEditor] = useRoute(ITEM_ROUTE);
  return (
    <div className={inItemEditor ? 'shell no-tabs' : 'shell'}>
      <UpdateBar />
      <main className="screen">
        <Switch>
          <Route path="/">
            <Placeholder title="Season">
              <p>
                <Link href="/tidy">Tidy</Link>
              </p>
            </Placeholder>
          </Route>
          <Route path={ITEM_ROUTE}>
            {({ eventId }) => <Placeholder title="Item" back={`/event/${eventId}`} />}
          </Route>
          <Route path="/event/:eventId">
            <Placeholder title="Event" back="/" />
          </Route>
          <Route path="/tidy">
            <Placeholder title="Tidy" back="/" />
          </Route>
          <Route path="/wrapped">
            <Placeholder title="Wrapped" />
          </Route>
          <Route path="/settings">
            <Placeholder title="Settings">
              <p>
                <Link href="/admin">Maintainer</Link>
              </p>
            </Placeholder>
          </Route>
          <Route path="/admin">
            <Placeholder title="Review" back="/settings" />
          </Route>
          <Route>
            <Placeholder title="Not found" back="/" />
          </Route>
        </Switch>
      </main>
      {!inItemEditor && <TabBar />}
    </div>
  );
}
