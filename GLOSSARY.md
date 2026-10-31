# Carnatic Wrapped

The language of logging the Carnatic concerts and lecdems one rasika attends in Chennai's December season, and of the Wrapped built from that log.

## Language

**Rasika**:
The person who attends Events and keeps the log.
_Avoid_: user, listener, audience member

**Maintainer**:
The person who runs the app and curates the Shared lists. Not a kind of Rasika.
_Avoid_: admin, moderator, operator

**Shared lists**:
The Artists and Sabhas every Rasika starts from, curated by the Maintainer. A Rasika's own hand-created entries link to them once promoted.
_Avoid_: seed list, master list, directory

### Events

**Event**:
Something the rasika attends, put on by a Sabha at a given time: either a Concert or a Lecdem.
_Avoid_: programme, performance, show, kutcheri

**Sabha**:
The organisation that puts on an Event, whether in its own hall or in someone else's. The hall itself is not recorded.
_Avoid_: venue, hall, organiser

**Concert**:
An Event in which musicians perform a sequence of pieces.
_Avoid_: kutcheri, recital

**Lecdem**:
An Event in which presenters discuss a titled musical topic, with or without demonstration.
_Avoid_: lecture, talk, lec-dem

**Schedule**:
The published list of upcoming Events across Sabhas, supplied by the logger project.
_Avoid_: listings, calendar, reckoner (the printed source, not the term)

**Plan**:
The Events the rasika intends to attend, picked from the Schedule or entered by hand.
_Avoid_: wishlist, my schedule

**Planned / Attended / Missed**:
The status of an Event. It is Planned until the rasika marks it Attended (by logging it) or Missed (by not going). Only Attended Events count in the Wrapped.
_Avoid_: skipped, cancelled (a cancellation is the Sabha's, not the rasika's)

### What is performed

**Item**:
One piece performed at an Event, in its place in the running order. An Item may perform a Composition or be improvised, such as an RTP.
_Avoid_: song, piece, number, track

**Detail**:
Any fact the rasika records about an Item: its Composition, Raga, Tala, Nadai, Composer, language, Subject and form, and the improvised parts heard, such as the alapana, tanam, niraval, kalpana swaram and Laya vinyasam.
_Avoid_: field, attribute, property

**Composition**:
A work in the catalog, with its own raga, tala, composer, language and subject as the catalog records them. The same Composition can be performed as an Item in a different raga.
_Avoid_: song, kriti (as a general word)

**Kriti**:
One form of Composition, alongside varnam, thillana, javali and the others. It is never the general word for a Composition.

**Laya vinyasam**:
The percussion solo in a Concert, played after an Item and in that Item's tala. It belongs to the Item it follows, but is not itself an Item.
_Avoid_: tani avartanam, tani, percussion solo

**Nadai**:
The subdivision of the beat that a Tala is played in: tisra, chatusra, khanda, misra or sankeerna. It qualifies the Tala of an Item, as in "Adi (khanda nadai)", and the Laya vinyasam.
_Avoid_: gati

### Ragas

**Raga**:
The melodic framework an Item is sung in. Most Items have one Raga. A ragamalika or an RTP can have several, in order.
_Avoid_: ragam (in writing), scale, mode

**Alias**:
Another spelling of the same Raga's name, such as Purvikalyani for Poorvikalyani. Aliases always collapse to one Raga.
_Avoid_: variant, synonym, linked raga

**Linked ragas**:
Two or more distinct Raga names the rasika has ruled are related, such as Pantuvarali and Kamavardhini. They are never merged and never treated as unrelated. The Wrapped counts them together, while each Item keeps its own name.
_Avoid_: name-pair (the logger project's term), sibling raga, same raga

### Doubt

**Unknown**:
A value the rasika doesn't know, entered as "?". It counts in the Wrapped as its own "?" bucket.
_Avoid_: blank, missing, n/a

**Not applicable**:
A Detail that has no value for this Item, such as the tala of a viruttam. It counts nowhere and is never Unknown.
_Avoid_: "-", "?", none

**Guess**:
A value the rasika marked as not sure, such as "Vararaga (?)". It counts as that value in the Wrapped and stays marked until confirmed.
_Avoid_: tentative, probable, hedge

**Unresolved**:
A value the rasika typed that is not yet matched to the catalog. It counts under the text as typed until it is matched.
_Avoid_: unmatched, unknown, free text

**Override**:
An Item's value that differs from what its Composition's catalog entry says, such as a kriti sung in another Raga. The Override is what counts.
_Avoid_: correction, edit, deviation

### People

**Artist**:
A person who performs or presents at Events, the same person across the whole season.
_Avoid_: performer, musician, presenter (as a kind of person)

**Role**:
What an Artist does at one Event: vocal, violin, veena, flute, mridangam, khanjira, ghatam, morsing, other, or presenter. It may be left blank when unknown. A Role says what someone did, not how important they were: no Role ranks above another.
_Avoid_: instrument, slot, lead, main artist, accompanist

**Appearance**:
One Artist in one Role at one Event, with the Colour they wore. The same Artist has a new Appearance at every Event. An Event's Appearances are in billing order: the first is the Artist the Event is known by, as on a concert poster.
_Avoid_: performance, booking, credit

**Colour**:
What an Artist wore at one Appearance: a primary colour from a fixed palette, plus an optional second colour for a two-tone outfit.
_Avoid_: outfit, attire, dress

**Composer**:
The person the catalog credits with a Composition. For an RTP, it is whoever wrote the pallavi, often the performer, when the rasika knows. A Composer can also be an Artist, as when a performer sings their own Composition, but the two are different terms.
_Avoid_: vaggeyakara (in writing), author, pallavi author

### Subjects

**Subject**:
What a Composition is about as the catalog records it, often a specific deity or shrine, such as Kamakshi or Nataraja.
_Avoid_: theme, deity

**Topic**:
A broad grouping of Subjects used by the Wrapped, such as Devi for Kamakshi or Shiva for Nataraja.
_Avoid_: category, theme

### The Wrapped

**Season**:
The yearly Chennai music season around December, named by its years, such as 2026-27. It is a name, not a boundary: Events are never cut off by it.
_Avoid_: Margazhi (a month within it), festival, year

**Wrapped**:
The statistics and Cards built from the Attended Events within a Wrapped range.
_Avoid_: summary, report, stats, recap

**Wrapped range**:
The dates a Wrapped covers. The rasika chooses it when opening the Wrapped, starting from a suggested range that fits the Events they attended.
_Avoid_: season dates, period, window

**Card**:
One shareable image from the Wrapped, such as the colours card or the composer timeline.
_Avoid_: slide, story, tile, poster
