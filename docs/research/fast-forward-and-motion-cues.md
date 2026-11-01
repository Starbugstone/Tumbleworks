# Fast-forward controls and calm conveyor motion

**Research date:** 31 October 2026

**Method.** I used web search, fetched pages, game source code and the current Tumbleworks working tree. No screenshots or videos were viewed, so layout and icon details are often missing. **Confirmed** means I read it in an official document, source code, a developer statement, or wiki or press text; some wiki text was seen only as a search excerpt because direct fetches were blocked. **Implied** means a player comment or my inference. Details I could not source are marked "not verified". Device behaviour has not been tested.

## 1. Hold-to-fast-forward

| Game | Mechanism | Placement | Icon | Active indicator | Notes |
| --- | --- | --- | --- | --- | --- |
| **Bloons TD 6** (Confirmed) | Toggle; Space on PC | Shares the Play control; position not verified | Play becomes fast-forward | Not verified | Bloons TD 4 required holding until an April 2011 update made it a toggle. Its rounds outlast a 3.6 s lap (Implied). |
| **RimWorld** (Confirmed) | Pick a speed: ×1, ×3, ×6; Space, 1, 2, 3 | Lower right | Dedicated speed buttons | Not verified | A mod page says the base game forces slowdown and blocks controls on certain events (Implied). |
| **Mini Metro** (Confirmed keys, Implied clock) | Pause or speed levels; Space, Left/Right | Reached through the clock, per a player | Clock | Not verified | The developer confirms Space. Sources conflict on number keys. |
| **Afterplay**, game emulator (Confirmed) | Hold, with toggle hotkeys kept | On-screen **Fast** touch button | Text label | Not verified | "Release to return to normal speed." Rates run 1.5×–8×. Audio speeds up by default, and muting is optional. |
| **YouTube mobile**, not a game but a widely learned gesture (Confirmed) | Long-press anywhere for 2× | The whole player | None | Message at top: "Playing at 2x speed" | The indicator sits away from the finger. Releasing restores the previous speed. |
| **Orbit: Satellite Defense** (Confirmed, devlog excerpt) | Hold F, or tap F to toggle | Keyboard | Not verified | Not verified | Both behaviours share one key. |
| **Peglin** (Implied) | Speed option up to 3× | Not verified | Not verified | Not verified | iOS launched without full speed-up. Players say physics feels odd at 2×. |
| **Kingdom Rush** (Implied) | None in the original or the Frontiers port | n/a | n/a | n/a | Players call the next wave early instead, for a small reward. Players asked for ×2 in 2014. |

**What I could not find.** No hypercasual sorter with a fast-forward button turned up, and no source mentions one in Marble Sort!. That is absence of evidence, not proof. I found nothing usable for Overcooked-likes, Dorfromantik or Unpacking. Balatro's speed is a menu setting of ×1–×4 (player reports), Arknights has a "Maintain 2x Speed" setting for auto-deploy runs, and Mini Motorways has "speed controls" with no layout documented.

**Patterns and pitfalls**

- **Wait length should decide hold or toggle (my inference).** Long waits favour toggles, as with Bloons and RimWorld. Our default Funnel Sort oval laps in about 3.6 s at speed 5.2 (computed from `RACEWAY`), or 1.2 s at ×3, which is short enough to hold.
- **Hold is not new or exotic.** Bloons dropped it, but Afterplay added it in February 2026 and Orbit kept it alongside a toggle.
- **Hold ends itself.** Toggles risk carrying speed into a moment that needs attention, which is why RimWorld reportedly forces slowdown. Holding removes most of that risk.
- **Thumbs hide indicators.** YouTube puts its message at the top of the player, not under the finger.
- **Adjacent buttons are the accidental-activation risk (Tumbleworks finding).** In the working tree, `#fast` sits next to `#restart`, and Restart reloads the level on a single click with no confirmation (`src/view/App.ts:70`).
- **Speed can feel like a rule change.** Peglin players blame physics at 2×. One Kingdom Rush player claimed speed-up lowers tower damage. Fixed-step simulation should prevent this, but it should be proved.

**Web implementation**

- **Capture.** The W3C spec says capture is released after `pointerup` or `pointercancel`, and `lostpointercapture` fires "prior to any subsequent events". Listening to all three is safe if the handler is idempotent.
- **Cancel triggers.** `pointercancel` must fire when the browser opens a menu or dialog, or takes the pointer for panning or zooming. The spec has **no long-press rule**, and `contextmenu` may come before or after `pointerup`.
- **`preventDefault` limits.** Cancelling `pointerdown` stops compatibility mouse events, but must not affect whether `click` or `contextmenu` fire. It does not stop panning either; only `touch-action` does.
- **`touch-action`.** It must be set before the gesture starts, because later changes are ignored. `none` also removes the click delay.
- **iOS `contextmenu`.** MDN lists the event as limited availability, and an Apple forum thread reports it not firing on long-press. Do not rely on it.
- **iOS callout and loupe.** `-webkit-touch-callout: none` is non-standard. One unanswered iOS 26.1 report says it failed on text. `-webkit-user-select: none` was reported in July 2025 to no longer stop the loupe. A WebKit engineer noted that an active `touchstart` listener calling `preventDefault` worked, though that note dates from 2021.
- **Android Chrome.** None of the documents I read gave Chrome-specific long-press behaviour, so it needs testing on a device.
- **Primary pointers.** `isPrimary` is true only for the first active touch. Filtering on it blocks two-finger play, as Recommendation 5 explains.

## 2. Showing conveyor motion calmly

No source publishes contrast values or phone legibility tests. The phone column is my judgement.

| Game | Technique | Contrast and density | Reads at phone size? |
| --- | --- | --- | --- |
| **Factorio** (Confirmed) | Full-tile animated belt; holes "show the belt movement underneath" | 4 belt pieces per tile, and a shared 8-frame cycle (player report). Busy by design. Staff called a 4× belt "visually too fast". | Implied no: dense, and a PC game |
| **Factorio freeze mods** (Confirmed) | Static belt with moving cargo | Belt motion removed. "Items on top of the belt will still move." Built for "migraines or... sensory overload". | Implied yes, when cargo is present |
| **Black Rubber Belts** (Confirmed) | Dark reskin | Glows off by default, with a "No arrows" option. Contrast not stated. | Not known |
| **shapez** (Confirmed, source) | 14-frame sprite loop tied to belt speed | Speed input capped at 10. "Potato mode" animates only the hovered path; other belts sit on frame 0. | Implied: browser game, phone use not verified |
| **Mindustry** (Confirmed, source) | 4-frame sprite loop | Frame locks to 0 when clogged or disabled, so motion doubles as state. | Implied yes: a coarse loop |
| **Mini Motorways** (Implied) | Cars supply the motion | The developer found watching cars "pretty satisfying". Static roads are my inference. | Implied yes: ships on iOS |
| **Dyson Sphere Program** (Implied) | Belts with no direction arrows, per a player | Dated player comment. | Not known |
| **Portal 2 water** (Confirmed, slide excerpt) | Flow-mapped normal map, two offset layers | One layer shows repetition; two offset layers reduce it, and noise hides pulsing. | Not applicable: river technique |

Satisfactory: I found no official description of its belt rendering.

**Findings**

- **Cargo can carry the motion.** Factorio mods freeze the belt and keep items moving. An empty belt is the case most likely to need a surface cue (my inference).
- **Animated belts cost attention.** The Factorio complaint is specific: "dividing my attention" and dizziness on the fastest belt. The requested fix was to freeze empty belts only.
- **Visual speed needs a ceiling.** Factorio staff and shapez's cap both treat this as a limit separate from simulation speed.
- **A coarse loop can be enough.** Mindustry animates its conveyors with only 4 frames.
- **Lighting ideas lack support.** I found no shipped example of edge lights showing belt direction, and the player has already rejected chasing side lights.
- **The working tree has moved on from the tick bars.** An uncommitted `src/view/belt-surface.ts` replaces them with one scrolling strip. Its unlit texture contrast against the base (WCAG formula) is: seam 1.29:1, chevron 1.21:1, edge 1.22:1. That is already low, so density and scroll rate are now the bigger risks.
- **At ×3 the plates can appear to run backwards (computed, not observed).** A pattern advancing more than half its period per frame looks reversed:

| Belt | Plate length | Rate ×1 / ×3 | Period per frame at ×3, 60 fps | At ×3, 30 fps |
| --- | --- | --- | --- | --- |
| Funnel Sort, current | 0.832 | 6.3 / 18.8 Hz | 0.31 | **0.63** |
| Loop Sort, current | 0.714 | 8.7 / 26.1 Hz | 0.43 | **0.87** |
| Funnel Sort, doubled | 1.664 | 3.1 / 9.4 Hz | 0.16 | 0.31 |
| Loop Sort, doubled | 1.428 | 4.3 / 13.0 Hz | 0.22 | 0.43 |

## Recommendations for Tumbleworks

1. **Keep hold-only at ×3.** Ship no toggle and no on-screen speed levels. A held lap takes about 1.2 s, and a release can never leave the game fast by mistake.
2. **Reorder the buttons to Restart, Undo, Hint, Fast.** At 54 px with an 18 px gap, buttons sit 72 px apart, and a miss from `#fast` should not reload the level. Fast stays at the right under the thumb.
3. **Engage on `pointerdown` with no delay and no ramp.** Return to ×1 on `pointerup`, `pointercancel` or `lostpointercapture`, and on window `blur` or `visibilitychange`. The tree already does this, and it matches the 100 ms tap target.
4. **Harden `#fast` for iOS.** Add `-webkit-touch-callout: none; -webkit-user-select: none; user-select: none`, and a `touchstart` listener with `{ passive: false }` calling `preventDefault`. Keep `touch-action: none` and the `contextmenu` handler. Test a 5 s hold on a physical iPhone and an Android phone, since Playwright cannot show callouts.
5. **Allow tapping while holding.** `src/view/App.ts:116` and `src/engine/pointer.ts:18` both filter on `isPrimary`. By that filter, a crate tap made while the thumb holds Fast is ignored, and Fast is ignored while another finger rests on the board. Replace both with an "already tracking a gesture" check. I read this from the code and have not tested it on a device.
6. **Move the `×3` badge above the button.** Use `top: -26px` and centre it horizontally, where a thumb will not cover it. Keep the pressed state. Add no speed lines, tint or vignette. The text and position avoid relying on colour.
7. **Do not pitch-shift sound effects.** Afterplay's audio speedup suits a continuous stream, while ours are one-shots. While held, allow each sample once per 60 ms and lower effects by 6 dB, so triple the events do not become a rattle.
8. **Measure ×3 on a phone before trusting it.** Funnel Sort runs three Rapier steps per frame while the pile is live. If mean frame time exceeds 24 ms over 500 ms, fall back to ×2 for that hold. Add a test that the same inputs at ×1 and ×3 give identical rule state at the same tick.
9. **Double the plate length.** Use about 1.66 on Funnel Sort (`MARBLE_RADIUS * 5.2`) and 1.43 on Loop Sort (`MARBLE_RADIUS * 8.4`). The default oval drops from about 22 plates to about 11, and reversal stops even at 30 fps. Keep seam contrast at or below 1.3:1 and chevrons at or below 1.2:1, one chevron per plate, for empty-belt direction. Add no rollers, edge lights or normal maps.
10. **Stop the belt texture under `prefers-reduced-motion: reduce`.** Hold the `BeltSurface` texture offset still and let marbles and cargo keep moving, as the Factorio freeze mods do. `belt-surface.ts` has no such branch today.

## Sources

**Fast-forward**

- https://www.bloonswiki.com/Fast_Forward (excerpt)
- https://www.bloonswiki.com/Round (excerpt)
- https://www.bloonswiki.com/Hotkeys (excerpt)
- https://www.magicgameworld.com/?p=27335
- https://rimworldwiki.com/wiki/Time
- https://www.nexusmods.com/rimworld/mods/408 (excerpt)
- https://www.familygamingdatabase.com/accessibility/Mini+Metro
- https://steamcommunity.com/app/287980/discussions/0/598198356180790150
- https://metafilter.com/164531/A-transit-planner-looks-at-Mini-Metro (excerpt)
- https://en.wikipedia.org/wiki/Mini_Motorways
- https://afterplay.featurebase.app/help/articles/2738631-fast-forward
- https://afterplay.featurebase.app/changelog/new-hotkeys-hold-fast-forward-and-slow-motion
- https://techcrunch.com/2023/07/18/youtube-test-2x-playback-speed
- https://www.tomsguide.com/computing/mobile-apps/ive-been-watching-youtube-wrong-this-hidden-mobile-feature-is-a-game-changer (excerpt)
- https://bluishgreenpro.itch.io/orbit-satellite-defense/devlog/27211/fast-forward-to-v051 (excerpt)
- https://toucharcade.com/?p=309401
- https://redlib.ssps.io/r/Peglin/comments/1idpd2r/are_physics_jankier_on_2x_speed (excerpt)
- https://steamcommunity.com/app/246420/discussions/0/522730700387363452
- https://nookgaming.com/kill-everything-kingdom-rush-frontiers-review/ (excerpt)
- https://steamcommunity.com/app/2379780/discussions/0/6426156954538745672 (excerpt)
- https://arknights.wiki.gg/wiki/User_interface
- https://www.huxiu.com/article/4852236.html (excerpt)

**Web input**

- https://w3c.github.io/pointerevents/
- https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event
- https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
- https://developer.mozilla.org/en-US/docs/Web/API/Element/lostpointercapture_event
- https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event
- https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-touch-callout
- https://developer.apple.com/forums/thread/808606
- https://developer.apple.com/forums/thread/699147
- https://bugs.webkit.org/show_bug.cgi?id=231161
- https://bugs.webkit.org/show_bug.cgi?id=220899

**Motion cues**

- https://cf-www.factorio.com/blog/post/fff-269
- https://forums.factorio.com/viewtopic.php?p=392527
- https://forums.factorio.com/viewtopic.php?p=679660
- https://forums.factorio.com/viewtopic.php?p=640876 (excerpt)
- https://mods.factorio.com/mod/BeltAnimationFreeze
- https://mods.factorio.com/mod/ghost-logistics
- https://mods.factorio.com/mod/black-rubber-belts-remastered
- https://raw.githubusercontent.com/tobspr-games/shapez.io/master/src/js/game/systems/belt.js
- https://github.com/Anuken/Mindustry/blob/master/core/src/mindustry/world/blocks/distribution/Conveyor.java
- https://www.thumbsticks.com/hustle-and-bustle-how-mini-motorways-built-its-wuselfaktor/
- https://steamcommunity.com/app/1366540/discussions/0/5739253211806579298 (excerpt)
- https://www.advances.realtimerendering.com/s2010/Vlachos-Waterflow(SIGGRAPH%202010%20Advanced%20RealTime%20Rendering%20Course).pdf (excerpt)
