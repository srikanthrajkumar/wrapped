# The instrument picker

A component spec, written on 2026-11-19 from the user's brief: "We should not have any
instrument left out of this or forced to be under other … pick a few common ones and then
truncate the rest only on click." The user answered both questions, one at a time:

- **Decision 1, an instrument not on the list:** a closed list. Every instrument the logger has
  seen gets its own Role, and there is no "Other" chip. An instrument still missing is left
  blank ("Not sure") and added to the list. It is never typed in.
- **Decision 2, the drum's word:** "Kanjira", as the listings print it. The stored key stays
  `khanjira`.

The picker is the Role chips (`RoleChips`, `app/src/screens/components/NamePicker.tsx:197`). They
show in the Add Artist sheet right after a name is picked, and in an Artist's sheet from Stage.

**Builds on:** [foundations.md](foundations.md), [row.md](row.md), [search.md](search.md) and
[item-editor.md](item-editor.md), as signed off. The chip is the foundations' chip, unchanged.

**These DESIGN.md rules stay as they are:**

- No Role ranks above another (FR-004). The order only arranges what is shown.
- An Artist logged before has their usual Role chosen and saved at once.
- "Not sure" shows only right after adding.
- A Role behind More that is current shows pressed with More open, so it is never hidden.
- Stage order, the Roles a Concert is known by, and the violin rule (2026-11-10).

**Out of scope:** Colours, the name search, and the Artist's sheet around the chips.

**Status:** a spec only. No app code or logger code has changed. The DESIGN.md change is in
[instrument-picker-design-md.diff](instrument-picker-design-md.diff), applied to DESIGN.md on 2026-11-19.

## 1. Today's picker, mapped

Shot at 393×852 in light and dark from main 5985946, after Log a Concert → Add Artist → a new
name.

| Element | Today | Against the brief |
| --- | --- | --- |
| Roles | 18, fixed in `ROLES` (`app/src/model/records.ts:28`), the same list the logger emits (`APP_ROLES`, `logger/pipeline/schedule/lib/lib-roles.ts:11`). | Anything else has no Role. |
| First chips | 10, in `COMMON_ROLES`: Vocal, Veena, Flute, Violin, Mridangam, Ghatam, Khanjira, Morsing, **Other**, **Presenter**. Then "More ⌄" and "Not sure". That makes four rows. | Other and Presenter take two of the first places, but at a Concert neither is common. |
| At a Dance | Dancer and Nattuvangam join the first chips. | Kept. |
| More | It opens all 18 in place, **re-sorted in Stage order**. Vocal moves from first to third, Dancer and Nattuvangam jump to the top, and More disappears. | The chips the thumb was on move. The code's own comment says "the chips it held follow the common ones". |
| Other | A chip in the first row. The logger maps viola, tabla, sarod, piano, guitar, keyboard, sitar, drama and villu pattu to `other`. | The brief: nothing "forced to be under other". |
| Word | "Khanjira". | The listings print "Kanjira". |
| Where the words come from | `roleName` (`app/src/screens/format.ts:103`) capitalises the key. Only `support` reads "Vocal support". | |

## 2. What the data holds

The newest feed, `schedule.2026-27.86184c66….json` (17 Nov, 542 entries, 1,348 billed people),
and the logger's resolved listings, `out/events.json` (609 events, with each role as printed).

| Role | Billed | Artists | Printed as |
| --- | ---: | ---: | --- |
| vocal | 374 | 189 | "Vocal - Carnatic", "Vocal", "Vocals", "Vocal duet" |
| violin | 284 | 118 | "Violin", "Violin duet", "Violin trio" |
| mridangam | 276 | 123 | "Mridangam" |
| dancer | 110 | 92 | "Bharatanatyam", "Bharathanatyam", "Odissi", "Kuchipudi" |
| ghatam | 104 | 40 | "Ghatam" |
| khanjira | 66 | 21 | "Kanjira" (57), never "Khanjira" |
| veena | 24 | 12 | "Veena", "Veenai" |
| presenter | 19 | 12 | "Discourse", "Harikatha", "Lecture" |
| flute | 15 | 9 | "Flute", "Flute - Carnatic" |
| morsing | 13 | 10 | "Moharsing" (9), "Moorsing" (3), "Morsing" (1) |
| thavil | 13 | 12 | "Thavil" |
| nagaswaram | 12 | 12 | "Nagaswaram", "Nadaswaram" |
| other | 12 | 11 | piano 4, tabla 3, villu pattu 3, guitar 2, viola 1, sarod 1, drama 1 |
| mandolin | 11 | 8 | "Mandolin" |
| no Role | 7 | 7 | blank, "Namasankeerthanam", "Guests of" |
| support | 5 | 5 | "Vocal support" |
| chitravina | 4 | 3 | "Chitra veena", "Chitravina" (and "Gottuvadyam" maps here) |
| saxophone | 1 | 1 | "Saxophone" |

The logger session ("Carnatic logger router") confirmed these counts on 2026-11-19 and named who
sits under `other` and what is dropped:

- **`other`, by what is played:** piano (Anil Srinivasan ×2, Lydian Nadhaswaram), viola
  (V.V.S. Murari), sarod (Soumik Datta), tabla (Debjit Patitundi, Praveen Narayanan) and guitar
  (Vignesh Shankar). S. Karthick conducts the Heartbeat Ensemble, and there is no conductor Role.
  Bhaskar Bhuyun, Aditya Mohan and N. Sundar are `other` by ruling, with no instrument printed.
- **Dropped (null), though an instrument:** "Madhuraveena" 1, "HandSonic" 1 (an electronic
  percussion pad) and "Ghata" 1 (a ghatam cut short). "Tavil" without the h isn't matched either.
- **Not instruments, rightly null:** Fusion Music, Light Classical, Devotionals, Film Songs,
  Hindustani music, Solo, Duet, and the like.

Many sources print the instrument inside the name ("N. Chandrasekhar-Harmonium", "Flute J A
Jayant"). The logger strips it there, so the raw captures name keyboard, sitar, harmonium and
santoor although no `role_printed` does. Clarinet, jalatarangam and konnakol are in none of this
Season's listings, but each is heard on Carnatic stages. They are added so the list doesn't fail
on its first rare concert.

## 3. Decision 1: a closed list, with every instrument its own Role

Thirteen Roles join the eighteen: **madhuraveena, clarinet, guitar, keyboard, piano, sitar,
sarod, santoor, jalatarangam, harmonium, viola, tabla, konnakol.** `other` stays a valid stored value, so no
stored row is rewritten, but the picker never offers it and the logger never emits it.

The rejected option was "Another…": a typed instrument stored as text in a new Appearance field.
It needs a data change, a sync round trip and an ADR, for a case this Season's data never
shows. With a closed list, an instrument the list lacks is a gap the Maintainer fills. It is not
a value the rasika has to invent.

**Stage order.** The new Roles slot in without moving any earlier one. They are listed as a
printed kutcheri listing would place them: melody before percussion, lead melody before its
accompaniment.

> dancer, nattuvangam, vocal, vocal support, veena, chitravina, **madhuraveena**, flute,
> nagaswaram, saxophone,
> **clarinet**, mandolin, **guitar, keyboard, piano, sitar, sarod, santoor, jalatarangam,
> harmonium**, violin, **viola**, mridangam, thavil, **tabla**, ghatam, kanjira, morsing,
> **konnakol**, other, presenter

**How each new Role behaves elsewhere** (settled here, all following the 2026-11-06 Roles):

| Role | Names a Concert (`KNOWN_BY.concert`) | A Concert's type (`TYPED`, ADR 0011) | Motif form |
| --- | --- | --- | --- |
| clarinet | yes | yes | breath |
| madhuraveena, guitar, keyboard, piano, sitar, sarod, santoor, jalatarangam | yes | yes | pluck |
| harmonium | no, it accompanies | yes | breath |
| viola | no, as violin; the violin rule stays violin's own | yes | bow |
| tabla, konnakol | no | yes | pulse |

So a guitar concert reads "Guitar". A sitar and a veena on one Stage read "Jugalbandi",
as ADR 0011 already does for two lead Roles.

## 4. The first chips, ranked by the data

Eight chips show first: the instruments billed most, put in Stage order so that each one sits
where it will sit on Stage.

```
393px, the Add Artist sheet after a new name
┌─────────────────────────────────────────┐
│ Add Artist                            ✕ │
│                                         │
│ Role                                    │
│ (Vocal) (Veena) (Flute) (Violin)        │
│ (Mridangam) (Ghatam) (Kanjira)          │
│ (Morsing) (More ⌄) (Not sure)           │
└─────────────────────────────────────────┘
```

By billings, they are vocal 374, violin 284, mridangam 276, ghatam 104, kanjira 66, veena 24,
flute 15 and morsing 13. Morsing ties thavil at 13, and morsing gets the place: thavil comes with
a nagaswaram concert, and the user named morsing. That makes three rows where today has four.

| Event kind | First chips |
| --- | --- |
| Concert | the eight |
| Dance | Dancer, Nattuvangam, then the eight (110 dancer billings) |
| Lecdem, Harikatha | the eight, then Presenter (Stage order puts it last) |

Presenter leaves a Concert's first chips (19 billings, all at a Lecdem or a Harikatha). Other
leaves the picker altogether.

## 5. More

One tap on "More ⌄" opens every other Role in place.

- **The first chips never move.** The rest follow them in Stage order, and More goes. "Not sure",
  when it shows, stays last. This fixes today's re-sort.
- Focus goes to the first chip revealed, so VoiceOver reads on from there. More has
  `aria-expanded="false"` and is removed once opened, as today.
- More stays open until the sheet closes. It opens again closed, unless the current Role is
  behind it.
- The sheet grows to fit, about ten rows of chips at 393px, and scrolls once it reaches the top
  margin. No search box: 30 chips are scanned faster than typed.

```
after More, at a Concert
│ Role                                    │
│ (Vocal) (Veena) (Flute) (Violin)        │
│ (Mridangam) (Ghatam) (Kanjira)          │
│ (Morsing) (Dancer) (Nattuvangam)        │
│ (Vocal support) (Chitravina)            │
│ (Madhuraveena) (Nagaswaram)             │
│ (Saxophone) (Clarinet)                  │
│ (Mandolin) (Guitar) (Keyboard) (Piano)  │
│ (Sitar) (Sarod) (Santoor)               │
│ (Jalatarangam) (Harmonium) (Viola)      │
│ (Thavil) (Tabla) (Konnakol)             │
│ (Presenter) (Not sure)                  │
```

## 6. Words

- Each chip is the Role capitalised, one word as a rasika says it: "Kanjira", "Morsing",
  "Nagaswaram", "Chitravina", "Madhuraveena", "Jalatarangam", "Konnakol", "Thavil". `support` stays "Vocal
  support".
- "Kanjira" applies everywhere `roleName` shows: chips, the caption under a name, a Concert's
  type, "Kanjira support", and DESIGN.md's prose. Stored keys never change.
- Printed variants (Moharsing, Nadaswaram, Nathaswaram, Veenai, Gottuvadyam, Tavil, Ghata) are
  the logger's to map.
  The chip shows one word each.

## 7. States and edge cases

| State | What shows |
| --- | --- |
| New Artist, Concert | The eight, More, Not sure; none pressed |
| Known Artist, usual Role among the eight | That chip pressed, saved at once |
| Known Artist, usual Role behind More (Tabla) | More open, Tabla pressed |
| Stored `other` (before 2026-11-19) | More open, "Other" pressed after the last Role; another chip replaces it, and tapping Other clears it. Once it is gone, Other is never shown again for that row |
| Feed billed a new Role, and the phone predates it | The phone reads it as no Role (schedule-feed.md: an unknown Role is null), so nothing breaks |
| An instrument not on the list | Not sure, or no chip: the Role stays blank. The Maintainer adds it |
| Dance | Dancer, Nattuvangam, the eight, More |
| 200% text | Chips wrap; the sheet scrolls; nothing truncates |

## 8. The data change

A closed-list extension, like the eight Roles of 2026-11-06 (T057). That one was recorded in the
Decisions Log without an ADR. **No ADR is needed**: there is no new field and no new type, and
no Role ranks above another. If Decision 1 is ever reopened as a typed instrument, that one
needs an ADR.

**Wrapped** (one change, in this order: app first, so a phone knows a Role before the feed bills
it):

- `ROLES` in `app/src/model/records.ts`: the thirteen, after `nattuvangam`. Its comment notes the
  date.
- `STAGE_ORDER` (`store/stage.ts`), as in §3. The compile-time check already fails until every
  Role is placed.
- `KNOWN_BY.concert` and `TYPED` (`store/stage.ts`), and `FORMS` (`motif/seed.ts`), as in the
  table in §3.
- `COMMON_ROLES` / `DANCE_ROLES` and the More order in `NamePicker.tsx`, as in §4 and §5. A
  Lecdem's and a Harikatha's first chips add Presenter.
- `ROLE_NAMES` in `format.ts`: `khanjira: 'Kanjira'`.
- `specs/001-season-logger/data-model.md` (Appearance `role`), `GLOSSARY.md` (Role and
  Appearance), and `contracts/schedule-feed.md`: "maps printed roles to these values, never
  to `other`".
- `supabase/tests/sync.test.ts` (T119) round-trips every Role: add the thirteen.
- Tests: the picker's first chips per kind; More keeps the first chips in place; a stored
  `other` shows pressed.

**Logger** (`pipeline/schedule/lib/lib-roles.ts`, after Wrapped ships):

- `APP_ROLES` and `RULES`: madhuraveena (before veena), tabla, piano, guitar (and "Guitar -
  C"), keyboard, sitar, sarod, santoor, harmonium, viola, clarinet, jalatarangam, konnakol, each
  to its own Role. Gottuvadyam stays chitravina. "Tavil" maps to thavil, "Ghata" to ghatam, "Nathaswaram" to nagaswaram.
- `rules/artist-normalize.json` and `rules/programme-rulings.json`: each Artist ruled `other`
  gets their instrument (Lydian Nadhaswaram piano; Bhaskar Bhuyun, Aditya Mohan and N. Sundar,
  once the Maintainer knows theirs), or no Role.
- Villu pattu goes to presenter (a told story, as a Harikatha is) and drama to no Role. Nothing
  maps to `other`.
- `check.ts` fails on a printed role that maps to nothing and isn't on a known not-a-role list
  ("Namasankeerthanam", "Guests of", "Title Bestow"). So a new instrument is caught before it
  ships blank.

**Risk:** an older cached app that edits an Appearance pulled with a new Role fails its write
check ("unknown role", `store/rules.ts:75`). One writing device (ADR 0003) and the PWA's update
on launch make this unlikely. Shipping the app before the feed closes it.

## 9. Raised, not changed

- **HandSonic and a conductor get no Role** (the user, 2026-11-19: "leave handsonic and
  conductor"). HandSonic is an electronic percussion pad, with 1 billing. S. Karthick conducts
  the Heartbeat Ensemble. Both stay on Stage with their Role blank, found by name as any Artist
  is. The logger bills them with no Role, never `other`. Revisit only if pads or conductors
  recur.
- **Namasankeerthanam** (13 billings, no Role): its singers are vocal, but it is a genre, not an
  instrument. The logger could bill them as vocal. This is the Maintainer's call, outside the
  picker.
- **Hindustani or light vocal** ("Vocal - Hindustani", "Light classical") bill as vocal. The
  genre sits on the Event, not the Role.
- **Upa-pakkavadyam** names the group (ghatam, kanjira, morsing), not an instrument, so it is
  not a Role.
- **A Role's count:** if the Wrapped ever lists instruments heard, the thirteen new Roles each
  count on their own, and `other` rows count as "Other".
- **The item-editor spec** names "khanjira" in §8 prose. It becomes "kanjira" when this is
  applied.

## 10. Proposed DESIGN.md change

[instrument-picker-design-md.diff](instrument-picker-design-md.diff), applied to DESIGN.md on 2026-11-19. It rewrites:

- "Artist and Sabha pickers": the Role chips, now the instrument picker;
- "Stage order": the thirty-one Roles;
- "An Artist" in the motif: the new Roles' forms, and "kanjira";
- the Decisions Log, with a row for 2026-11-19.
