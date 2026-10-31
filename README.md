# Carnatic Wrapped

Every year, a group of three of us log copious details of our hop around Carnatic kutcheris during the last weeks of December. Our process was fairly amateur; we'd log things on a spreadsheet. In an age where this is a little easier to do, we'd thought to app-ify this.

## What we're careful about
The way we design this app can influence how people listen to the music. So what we choose to count, and what we call things, matters. With that in mind, we've made a few deliberate choices:

- **Laya vinyasam, not tani avartanam.** The percussion solo is a full part of the concert, not
  an interval.
- **No main artist and no accompanists.** Everyone on stage is logged the same way and counts
  the same in the Wrapped. The order they're listed in is the only thing that says whose concert
  it was. (This may change, but for now it's on purpose.)
- **Nothing about a single artist's repertoire.** The app never publishes what any one artist
  performed across the season. How an artist builds their concert lists is theirs, and a public tally
  of it isn't ours to make.

## What it does

- **Log a concert while it happens.** Search a catalog of about 30,000 compositions, and pick
  the raga, tala and composer instead of typing them. Typos and spelling variants still find the
  right entry.
- **Works with no signal.** Sabha halls often have none. Everything you need to log lives on the
  phone, and nothing you type waits for the network.
- **"I'm not sure" is allowed.** Mark a guess, put "?", or type something the catalog doesn't
  know. All of it is kept as you wrote it, and you can tidy it later.
- **Plan ahead.** Pick the concerts you mean to go to, so the Sabha and artists are already
  filled in when you arrive.
- **The Wrapped updates as you go.** Colours, ragas, composers on a timeline, the artists you saw
  most. Each one is a card you can share.
- **Nothing is lost.** Your log backs up to a server whenever you have signal, and comes back if
  you lose or change your phone.

## Status

In development for the 2026-27 season. The goal is logging on the phone by 1 December 2026 and
the Wrapped cards by 20 December.

## How it's built

An installable web app (React and Vite) that keeps everything in the phone's own storage
(IndexedDB, through Dexie). Changes queue up on the phone and sync to Supabase when there's
signal. Sign-in is with Google, once, at first launch.

Everything was planned before any code was written. If you want the why behind a decision:

- [Constitution](.specify/memory/constitution.md): the rules that win over everything else
- [Glossary](GLOSSARY.md): what Rasika, Item, Detail, Linked ragas and the rest mean here
- [Spec](specs/001-season-logger/spec.md), [plan](specs/001-season-logger/plan.md) and
  [tasks](specs/001-season-logger/tasks.md) for version 1
- [Decision records](docs/adr/) for the choices that are hard to undo

## The catalog

The compositions, ragas and composers come from [karnatik.com](https://www.karnatik.com),
gathered and cleaned up in a separate project. The app uses the facts (title, raga,
tala, composer, language, subject), not lyrics or meanings. That data isn't published in this
repository, and the code's licence doesn't cover it.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Issues are welcome. Pull requests will have to wait until
after the season.

## Licence

[MIT](LICENSE) for the code and documents. The catalog data is not included.
