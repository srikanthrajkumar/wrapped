# Launch video plan

The plan for the Carnatic Wrapped launch video, agreed with the Maintainer on 2026-11-20. Nothing
has been made yet. The build runs in its own sessions, after this plan.

## What was decided

| Question         | Decision                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience         | Rasikas who will be in the halls this December.                                                                                                                             |
| Where            | WhatsApp (chats and Status) and Instagram (Reels and Stories).                                                                                                              |
| Format           | Vertical, 1080 × 1920, 30 fps, about 80 seconds.                                                                                                                            |
| Release          | **Tuesday 1 December 2026**, with logging.                                                                                                                                  |
| Story            | Last season's spreadsheet, then one evening at a concert, logged as it happens.                                                                                             |
| Voice-over       | The Maintainer's own voice. Talk over the rough cut unscripted, trim those words into the script, then record the trimmed script cleanly.                                   |
| Visuals          | The real app, shot by the seeded rig (`app/e2e/hill-climb/`) in Chromium, and framed in Remotion. No iPhone recordings.                                                     |
| Music            | The Maintainer's father singing with his friend, from a concert recording on YouTube (2:02:43 to 2:08:07), with his permission. Fallback: a tanpura drone made with the shruti synth. |
| On-screen artists | The seed's real names stay (Ranjani & Gayatri and their accompanists), the Maintainer's call. The note's "thani" becomes "Layavinyasam" in the video's seed.               |
| End card         | The kolam and **carnatic.live**. The final render waits until carnatic.live points at the app; connecting it is a separate task.                                            |

Two small calls made in this plan, with the reason:

- **No phone mock-up.** The app's screen is about 9 : 19.5, so it fills a 9 : 16 frame almost
  edge to edge. The app's own dark ground is the video's ground. A device frame reads as an ad.
- **No drawn keyboard.** Headless Chromium draws none, and a fake iOS keyboard reads as a
  mock-up. The search beat is cropped close on the search box and its results, so the missing
  keyboard isn't noticed.

## The look

The video follows `DESIGN.md`, not a separate style.

- **Ground:** the dark theme's page, `--background`. Text in `--foreground` (warm, 0.88).
- **Type:** Source Sans 3 only, from `app/src/styles/fonts/`. Sentence case. Weights 400, 600 and
  700. A title in the video uses the `heading` or `display` role, scaled for 1080 wide.
- **Colour:** rose only in the motif, as in the app. No other accent.
- **Motion:** the app's own motion, captured, not re-made. Anything Remotion adds (pans, crops,
  the kolam drawing) uses the app's curve, `cubic-bezier(0.32, 0.72, 0, 1)`, and moves slowly.
  No whooshes, zooms that bounce, or UI sound effects.
- **Words on screen:** as few as possible. The voice carries the story; the app's own screens
  carry the rest. Captions are the one exception (below).
- **The motif:** Paper's static mesh gradient, the app's own copy
  (`app/src/motif/paper-shaders.ts`), with the app's tones, seeds and 7% blur, and no grain. It
  appears where the app shows it (first launch's Silk, Season's curtain, the Concert summary's
  edge), recorded from the app, and twice more, drawn in Remotion with the same shader:
  - **Silk under the title and the end card** (the Maintainer, 2026-11-20). Laid out as first
    launch is: Silk over the top of the frame, dissolving into the page, with the kolam and the
    words low on the dark ground beneath it, outside Instagram's bottom 20%. Its folds drift on
    the app's periods (11, 14 and 19 seconds), drawn frame by frame from the same sway as
    `animateMotif`, so the video's Silk and the app's are one field.
  - **The season's field growing** (shot 11). The one place the video moves a mark the app
    holds still: it eases from one seed's field to the next, slowly.
- **The kolam:** drawn as the single closed line it is (geometry from `brand/kolam.mjs`), round its
  13 dots, once at the title and once on the end card.

**Captions.** Most Reels and Status videos are watched muted, so the voice-over is burned in as
captions: Source Sans 3, `secondary` size scaled up, sentence case, one short line at a time,
inside the safe zone. They are the script's words, nothing added.

**Safe zones.** Instagram's own buttons and caption cover the bottom of a Reel and its top edge.
Nothing that carries the story sits in the bottom 20% or the top 12% of the frame. Where the
app's bottom bar (Add Item) matters, the screen is drawn a little smaller and higher.

## Storyboard

About 80 seconds. Times are a starting point; the voice-over sets the final cut.

| #   | Time      | Shot                                                                                                                                                                                         | Source                          | Voice says (beat, not lines)                                    |
| --- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| 1   | 0:00–0:08 | Last season's spreadsheet. A slow pan along its rows: kriti names, ragas, a "?" or two, a typo.                                                                                            | The Maintainer's sheet, Remotion | Every December, three of us logged our concerts in this.        |
| 2   | 0:08–0:12 | Silk drifting at the top of the frame. Beneath it, the kolam draws itself as one line round its 13 dots; the name below. Silk carries straight on into shot 3, the same field.              | Remotion                        | (Breath. Music comes up.)                                       |
| 3   | 0:12–0:18 | First launch: Silk drifting above the words, then "Ready to log offline."                                                                                                                   | Rig                             | So we made it an app for the phone.                             |
| 4   | 0:18–0:24 | Season at 6 pm, Mon 14 Dec: the curtain, the Music Academy concert as the hero. "I'm here" is tapped.                                                                                     | Rig                             | You arrive, and the concert is already there.                   |
| 5   | 0:24–0:36 | Add Item. "chakani raja" typed letter by letter, cropped close; Chakkani Raja comes first. Picked: Kharaharapriya, Adi, Tyagaraja filled in.                                               | Rig                             | Type what you hear, even misspelt. The raga and composer follow. |
| 6   | 0:36–0:42 | The tala marked as a guess, "?" showing.                                                                                                                                                    | Rig                             | Not sure? Say so. It keeps what you wrote.                      |
| 7   | 0:42–0:48 | The Layavinyasam marked on the Item, its nadais and note.                                                                                                                                   | Rig                             | The Layavinyasam is part of the concert, not a break.           |
| 8   | 0:48–0:54 | Stage: the Colour sheet rises, red and white picked for Ranjani, the swatch settling.                                                                                                       | Rig                             | Even what they wore.                                            |
| 9   | 0:54–1:00 | An Item saved with no signal: a small no-signal mark in the corner (the video's, not the app's), the save highlight on the row.                                                            | Rig, with a Remotion mark        | Sabha halls have no signal. It doesn't need one.                |
| 10  | 1:00–1:08 | Three hours on: the Concert summary, its rose edge.                                                                                                                                         | Rig                             | At the end, the evening, seen whole.                            |
| 11  | 1:08–1:16 | The season's curtain growing: ink, then one rose, then a second as more Ragas are heard.                                                                                                    | Remotion, with `app/src/motif/`  | Your season adds up. The Wrapped arrives on 20 December.        |
| 12  | 1:16–1:20 | Silk again, as in shot 2: the kolam and carnatic.live beneath it.                                                                                                                           | Remotion                        | (Music out.)                                                    |

The right-hand column is what each shot has to get across, so the trimmed script can be checked
against it. It is not the script.

**Why this order.** The spreadsheet is the personal part, and it's true. The evening shows the
four things a rasika needs to believe before they rely on it in a hall: it's quick, it knows the
songs, it doesn't need signal, and it doesn't force a guess into a fact. The season's field is
the promise of the Wrapped, without showing cards that don't exist yet.

## Script

**Method: talk, then trim.**

1. The Maintainer watches the rough cut (temp music, no voice) and talks over it, unscripted,
   two or three times, as voice memos on the phone.
2. The memos are transcribed on this machine (whisper, run locally; nothing is uploaded).
3. Their own sentences are cut down to fit each shot, at about 2.3 words a second. That is about
   150 words in all, and less is better: the music needs room.
4. The Maintainer reads the trimmed script, changes anything that doesn't sound like them, and
   approves it.
5. They record it cleanly against the locked picture (below).

**Recording.** A quiet room with soft furnishings (a wardrobe of clothes works), the phone
15–20 cm away and a little to the side, the same room and time of day for every take. Three takes
of the whole script, then single lines again if needed. Saved as WAV or the phone's lossless
memo format, not compressed.

## Music

- **The recording** (2026-11-20): the Maintainer's father singing with his friend, from a
  YouTube concert recording (`HFi_nbVzO8E`), 2:02:43 to 2:08:07, as MP3. Only that section is
  kept, at `video/music/columbus-brothers-memphis-1999.mp3` (gitignored): 324 s, 192 kbps
  stereo, −15.9 LUFS integrated with a loudness range of 3.2 LU, so it sits evenly under a voice.
  The video uses about 80 seconds of it, chosen once it has been heard.
- **Permission:** given by the Maintainer's father. Ask how he and his friend would like to be
  credited. The credit goes in the post's caption, not on the video.
- **Raga on screen:** once the clip's raga is known, the search beat (shot 5) can log an Item in
  that raga instead of Chakkani Raja, so the music and the screen agree.
- **Mix:** the voice leads. The music sits about 12 dB under the voice while they talk and comes
  up in the pauses (shots 2 and 12). Final loudness about −14 LUFS, Instagram's target.
- **If the clip can't be used:** the tanpura drone from `shruti/src/audio/` (Sa and Pa at the
  clip's shruti, or C♯), rendered to WAV. The rough cut uses this anyway as its temp track.

## Production pipeline

All tooling lives in `video/` in this repository: its own `package.json`, not in the npm
workspaces, so the app's build, lint, tests and size budget never see it. Footage, renders and
recordings are gitignored.

1. **Video seed** (`app/e2e/video/seed.ts`). Builds on the hill-climb seed: the same clock
   (Mon 14 Dec, 7:30 pm in Chennai), the same concert, "Layavinyasam" in the note, and a fresh
   Item ready for the search beat.
2. **Capture** (`app/e2e/video/capture.ts`). Playwright at 390 × 844, device scale 3
   (1170 × 2532), dark theme, software WebGL so the motif draws. Each shot is a scripted run of
   taps and typing, saved as a PNG sequence. Playwright's own video recording is too soft, so
   frames come from the Chrome DevTools screencast with the page's animations slowed by the same
   factor (`Animation.setPlaybackRate`), then played back at speed. This is the first thing to
   prove; if it stutters, the fallback is stepping the animations frame by frame.
3. **Remotion** (`video/`). One composition per shot, 1080 × 1920 at 30 fps. It reads the font
   and the colour tokens from `app/src/`, draws the kolam from `brand/kolam.mjs` and the motif
   from `app/src/motif/`. The spreadsheet, the title and end card on Silk, the no-signal mark and
   the season's field are made here.
4. **Rough cut** with the temp drone and no voice. Sent to the Maintainer as an MP4.
5. **Talk-overs** from the Maintainer, then transcript, trim and approval (Script, above).
6. **Final voice** comes in; the music is already in hand.
7. **Picture lock:** shots re-timed to the voice. Captions set from the approved script.
8. **Mix:** voice, music and the hall sound (if any), with loudness normalised in ffmpeg.
9. **Render:** H.264 MP4, 1080 × 1920. One file for Reels and Status. If WhatsApp Status still
   caps a clip at 60 seconds on release day, a second cut that ends at shot 10.
10. **End card check:** carnatic.live opens the app on a phone. Then the final render.

If the app's screens change before 1 December, re-run the capture. The seed and the scripted taps
make a reshoot a command, not an afternoon.

**Licence check.** Remotion is free for individuals and companies of up to three people. This is a
personal project, so it should qualify; confirm before rendering the final.

**Skills.** Remotion publishes an agent skill. It isn't in `docs/skills-router.md`; vet it per §6
there before installing, or build without it.

## Schedule

| Date        | Step                                                                                    | Who                 |
| ----------- | --------------------------------------------------------------------------------------- | ------------------- |
| Fri 20 Nov  | Plan agreed. Music clip downloaded. Find last season's spreadsheet.                     | Maintainer          |
| Sat 21 Nov  | Build 1: video seed, capture proven on two shots, Remotion set up.                      | Build session       |
| Mon 23 Nov  | Build 2: every shot captured; rough cut with temp drone.                                 | Build session       |
| Tue 24 Nov  | Talk-overs recorded.                                                                    | Maintainer          |
| Wed 25 Nov  | Script trimmed and approved.                                                            | Together            |
| Thu 26 Nov  | Final voice recorded.                                                                   | Maintainer          |
| Fri 27 Nov  | Build 3: picture lock, captions, mix. Review cut sent.                                  | Build session       |
| Sat 28 Nov  | Notes on the review cut; fixes.                                                         | Together            |
| Sun 29 Nov  | carnatic.live connected (its own task). Final render.                                   | Maintainer, session |
| Mon 30 Nov  | Spare day.                                                                              |                     |
| Tue 1 Dec   | Release with logging.                                                                   | Maintainer          |

## What the Maintainer supplies

- [ ] Last season's spreadsheet (the file or a screenshot), and a yes on whose names in it may
      show. Others can be blurred or the rows recreated.
- [ ] The music clip (2:02:43 to 2:08:07, MP3), downloaded on your own computer, since YouTube
      blocks this VM. And how your father and his friend would like to be credited.
- [ ] Two or three unscripted talk-overs of the rough cut, as voice memos.
- [ ] Approval of the trimmed script.
- [ ] The final voice recording.
- [ ] Optional: 2–3 seconds of real hall sound (tuning up, applause) from any concert before then.
- [ ] Notes on the rough cut and the review cut.
- [ ] The go-ahead to connect carnatic.live to the app.

## Next

Build 1 in its own session: the video seed, the capture method proven on shots 4 and 5, and
Remotion set up in `video/` with the font and tokens.
