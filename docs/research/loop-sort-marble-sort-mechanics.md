# Loop Sort, Marble Sort!, and the conveyor-sorting family

Research date: **31 October 2026**. Scope: mechanics and presentation evidence for a browser adaptation; no changes to the implemented campaign are proposed here.

## Reading the confidence labels

- **Confirmed**: explicitly stated by the publisher/store, directly visible in an inspected image or sampled gameplay clip, or explicitly attributed to a named reviewer. A confirmed *reviewer's report* is not a verified universal game rule.
- **Implied**: the best reconstruction from the evidence, including clone rules, arithmetic, and analyst observations; still needs a controlled playthrough of the identified build.
- **Guessed**: unresolved hypothesis or suggested reconstruction, not established behavior. “Unknown” entries carry this label rather than inventing an answer.

Research used English, Chinese, Japanese, Korean, Turkish, French, Portuguese, and Russian searches; official listings and histories; Chinese press; analyst posts; store reviews; fan walkthroughs; YouTube metadata; and direct inspection of public images and three embedded Marble Sort clips. **No current app build was played, no YouTube/TikTok comment corpus was obtained, and no haptics were tested.** All numerical observations below are scoped to their source/build. Source links resolve through the reference definitions at the end.

## 1. Executive summary: rules as a specification

### 1.1 Identity and the most consequential correction

| Subject | Finding and confidence | Evidence |
| --- | --- | --- |
| Loop Sort identity | **Confirmed:** Voodoo publishes Android package `com.Garawell.LoopSort` and iOS app `6751101794`; the iOS listing credits Garawell Games in its copyright. | [Google Play][L-play], [App Store][L-ios] |
| Marble Sort identity | **Confirmed:** Android `com.microdose.balljam` and iOS `6754558455` are the requested Voodoo game. The Android display name currently reads **Marble Sort: Ball Color Puzzle**; iOS reads **Marble Sort! - Color Puzzle**. Microdose is independently identified as its developer. | [Android][M-play], [iOS][M-ios], [classification record][M-class] |
| Truck color versus cargo color | **Confirmed, visual:** multiple trucks have the **same purple body** while holding different and mixed cargo colors. **Implied:** a truck is a water-sort-like container, not necessarily a permanently body-colored destination. | [Official promotional frame, Level 7][L-shot7] |
| Fundamental distinction | **Implied:** Loop Sort recirculates cargo between containers that can both dispense and receive; Marble Sort drains a source board into a separate receiver queue. Treating both as a set of fixed-color trucks would erase this difference. | [Loop Sort analysis][L-sohu], [Marble Sort publisher rules][M-publisher] |

### 1.2 Loop Sort: minimal rule model

| Element | Specification supported by the evidence | Confidence / evidence |
| --- | --- | --- |
| State | Ordered cargo portions per truck; truck orientation/intake end; free cargo space; completed/blocked status; moving cargo with position and color; belt occupancy limit; hidden cargo and obstacle state. Keep **large cargo portions** separate from the **many tiny cubes** used to depict their movement. | **Implied**, model inferred from [gameplay analysis][L-sohu] and [actual-play screenshots][L-actual] |
| Starting contents | Trucks can contain several colors, adjacent matching portions, concealed portions, and empty space. Empty space is useful receiving capacity. | **Confirmed, visual:** [Level 9 promotion][L-shot9], [Level 13 actual-play screenshot][L-actual] |
| Main action | Tap a truck to release cargo onto the conveyor; receiving/sorting then occurs automatically. | **Confirmed:** [publisher][L-publisher] |
| What one tap releases | Best reconstruction: the exposed matching run at the truck's **open/belt-facing end**, potentially several adjacent portions of one color. It is **not established** that a tap empties the whole mixed truck, nor that it selectively removes “mismatched” cargo. | **Implied:** the [Level 9 frame][L-shot9] shows blue departing while green/hidden cargo remains; the [Truck Sort clone][C-truck] explicitly specifies the front matching group. |
| Run boundary | A different color, hidden portion, or blocker ends access to the next run. Exact handling of a partly reconstructed portion needs capture. | **Implied:** [layer-by-layer walkthrough][L-167]; **Guessed** for partial reconstruction. |
| Reception with cargo present | Free space alone is insufficient: the exposed cargo color matters. A Chinese hands-on analysis describes pickup matching the truck's outermost cargo color. | **Implied**, reported behavior rather than executable proof: [analysis][L-sohu] |
| Reception when empty | The same analysis describes an empty truck accepting circulating cargo; therefore its next color can be established dynamically. | **Implied:** [analysis][L-sohu] |
| Must a receiver be tapped first? | No separate activation action appears necessary: one tutorial walkthrough explicitly leaves the receiving truck untouched. Do not invent an “armed after tapping” flag. | **Implied:** [Level 1 walkthrough][L-1] |
| Competing receivers | Local arrival order/proximity appears important. Global prioritization of a nearly completed matching truck is unsafe to assume: a May reviewer reports changed distribution across open slots. | **Implied / version-sensitive:** [Google Play review by Asmodeus Himitsu, 5 May][L-play-old] |
| Continuous motion | Cargo circulates automatically after release. **Constant speed is unproven**; a hands-on analysis reports occupancy-dependent movement, including congestion. | **Confirmed** automatic movement: [publisher][L-publisher]. **Implied** speed variation: [analysis][L-sohu]. |
| Completion of a truck | A finished truck receives a check mark and stops serving as spare receiving space. **Immediate departure is unproven:** completed purple trucks remain visible in actual-play screenshots. | **Confirmed, visual** parked checks: [Level 13 screenshot][L-actual]. **Implied** completed lockout: [Level 2 guide][L-2]. |
| New trucks / lane advance | There is insufficient evidence for a universal queue that advances a replacement truck into every cleared bay. Do not import Marble Sort's receiver queue into this game. | **Guessed / unresolved:** compare [checked parked trucks][L-actual] with the explicit departure rule of the [Truck Sort clone][C-truck]. |
| Win | Resolve the required color groups / clear the level's cargo. A checked truck is a completed group; clearing a “line” is marketing language, not proof of a match-three row rule. | **Confirmed** advertised objective: [publisher][L-publisher]. **Implied** final predicate: [walkthrough hub][L-hub]. |
| Lose | Limited belt space is central; inability to make useful placements can end a run. A review reports a “no moves left” end despite only a few portions remaining. Exact jam/no-move evaluation and grace period remain unknown. | **Implied:** [player review archive][L-reviews], [analyst's complaint about unclear failure][L-storr] |
| Lives / retries | Lives and paid recovery exist in reviewed builds; quitting/interruption can affect streaks. These are session/economy rules, separate from the belt's local failure condition. | **Confirmed, reviewer reports:** [App Store review describing a lost heart][L-wolf], [App Store review on streak changes][L-ios] |

### 1.3 Marble Sort!: minimal rule model

| Element | Specification supported by the evidence | Confidence / evidence |
| --- | --- | --- |
| State | An upper board of source boxes and accessibility dependencies; falling/waiting marbles in the funnel; occupied belt positions; active receiving boxes with fill counts; future receivers in each column; obstacles and lives. | **Implied**, reconstructed from [store images][M-shot1], [sampled gameplay clip][M-video2], and [official rules][M-play]. |
| Action | Tap an accessible upper source box to release its marbles. Some boxes farther from the outlet are unavailable until nearer boxes are removed. | **Confirmed** tap-to-drop: [publisher][M-publisher]. **Implied** accessibility rule: [Chinese hands-on account][M-baijing]. |
| Release unit | A normal source releases a batch. Tall Box doubles it in one tap; linked sources can release together. Counts are in §2. | **Confirmed** doubling: [Android update][M-play]. **Implied** linked release: [feature index][M-features]. |
| Funnel | Released marbles physically fall, collide, mix and compete for the narrow exit. Rapid taps can interleave two colors rather than preserving whole-box FIFO order. | **Confirmed, analyst observation:** [AppMagic's own breakdown][M-appmagic] |
| Waiting supply | Marbles remain above the belt while earlier traffic travels. In the sampled Level 2 clip, red marbles wait at the mouth at 2–3 seconds and some still wait at 7 seconds. | **Confirmed, sampled frames:** [18.55-second embedded clip][M-video2] |
| Metering | The mouth and available belt spaces limit admission; excess released marbles are retained in the funnel. Exact vacancy reservation, invisible gates and funnel-overfill limits are unresolved. | **Implied** physical admission; **Guessed** hidden implementation details: [same clip][M-video2], [design analyst on overfill prevention][M-priyanath]. |
| Belt | The belt moves continuously and returns unmatched marbles around its circuit. It is a short elongated oval, not necessarily a literal circle. | **Confirmed** continuous motion: [publisher][M-publisher]. **Confirmed, visual** geometry: [official frame][M-shot2]. |
| Automatic intake | A passing marble enters an available receiver of its color; the player does not manually drag it into a target. | **Confirmed, sampled gameplay:** [Level 1 clip][M-video1] |
| Receiver completion | A standard target clears after receiving the advertised same-color count. The next box advances upward **in that column**, rather than all columns necessarily advancing together. | **Confirmed** match requirement: [official Android rules][M-play]. **Confirmed, visual** independent queue motion: [Level 1 clip][M-video1]. |
| Multiple matches | Several matching receiver columns can absorb a batch. Exact first-eligible-column precedence and same-frame reservations are unmeasured. | **Implied:** [nine-marble accounting guide][M-nine]. **Guessed** tie-breaking. |
| Win | Collect all required marbles into the receiving boxes; finishing the upper-board releases alone is insufficient while the final marbles are still travelling. | **Confirmed, sampled end sequence:** [Level 18 ending clip][M-video3] |
| Lose | **Full belt and no matching box**. Exact timeout unknown. | **Confirmed** condition; **Guessed** timeout: [Google Play][M-play]. |
| Input during motion | Multiple releases can overlap. Whether a particular source is temporarily blocked by an animation or cooldown is unverified; the game is not described as one animation per turn. | **Confirmed** overlap in [AppMagic analysis][M-appmagic]; **Guessed** cooldown duration. |

**Implied:** nine marbles fill three ordinary receivers; fewer available targets leave surplus. **Guessed, adaptation choice:** retain waiting-funnel inventory and wait for final deliveries before winning. [Official loss predicate][M-play], [surplus guide][M-nine]

## 2. Numbers: measured, reported, and still unknown

### 2.1 Counts and capacities

| Game / quantity | Value | Status and limitations | Evidence |
| --- | --- | --- | --- |
| Loop Sort, ordinary truck capacity | About **4 large cargo portions** in several frames | **Implied, visual**, not four tiny travelling voxels; other truck sizes are not excluded. | [Level 7 frame][L-shot7], [orientation examples][L-orient] |
| Loop Sort, voxels per portion | **Unknown** | **Guessed/unmeasured**; large portions disintegrate into many small cubes. Avoid equating rendered particle count with logical belt capacity. | [actual-play frame][L-actual] |
| Loop Sort, belt HUD | Examples **3/5**, **3/4**, **1/4**, **2/6** in promotions; **2/13** in an actual-play Level 13 frame | **Confirmed, visual** values; **Implied** occupancy/capacity reading. One guide explicitly warns against reading another level's fraction as capacity, so the units need a build-specific test. | [promotions][L-shot7], [Level 9][L-shot9], [Level 20][L-shot20], [Level 48][L-shot48], [actual frame][L-actual], [conflicting guide][L-393] |
| Loop Sort, trucks visible | **5** central horizontal trucks in one Level 7 promotion; **6** around the figure-eight in Level 9; **12** arranged 4+4+4 in Level 48 | **Confirmed, visual examples**, not a fixed parking-lane count or proof of actual level numbering. | [Level 7][L-shot7], [Level 9][L-shot9], [Level 48][L-shot48] |
| Loop Sort, color bands | Tutorial guides report **1 color at L1**, **2 at L2**, **3 at L3**; another labels L174 **10 colors** | **Implied**, secondary walkthrough classifications, not an audited progression curve. | [L1][L-1], [L2][L-2], [L3][L-3], [L174][L-174] |
| Loop Sort, typical loop density | No reliable average | **Confirmed, visual:** dozens to hundreds of small cubes can form a broad, irregular stream, including multiple cubes across the belt. **Guessed:** exact peak or typical count. | [Level 7 promotion][L-shot7], [actual-play examples][L-actual] |
| Marble Sort, standard source | **9 marbles**, usually visually **3×3** | **Confirmed, visual** 3×3 source representation; **Implied** universal normal-box count. | [official source image][M-shot1], [independent detailed count][M-baijing] |
| Marble Sort, Tall Box | **2× normal**; **18 if normal=9** | **Confirmed** doubling; **Implied** 18. | [official Android update][M-play] |
| Marble Sort, belt capacity | **21 reported** | **Implied:** a Chinese hands-on article explicitly gives 21; a fan guide says approximately 21. No controlled current-build saturation test was performed. Printed/painted belt sockets in promotional art are not a capacity proof. | [Chinese article][M-baijing], [fan accounting guide][M-nine] |
| Marble Sort, standard receiver | **3 same-color marbles** | **Confirmed, official rule.** | [Google Play][M-play] |
| Marble Sort, active receivers | **4 columns** in inspected early gameplay and promotional examples | **Confirmed for those layouts**; not established for every variant. | [Level 1 video][M-video1], [official frame][M-shot1] |
| Marble Sort, visible future queue | At least **3 following boxes per column** in one promotion | **Confirmed, visual**, with more content potentially off-screen; queues rise toward the belt. | [official frame][M-shot2] |
| Marble Sort, first level content | **6 source boxes**, **2 colors**; **54 marbles / 18 ordinary receivers** if all six sources contain nine | **Confirmed, visual** six sources and two colors; **Implied** totals by multiplication. | [opening frame of embedded Level 1 video][M-video1] |
| Marble Sort, second-level colors | Yellow, red/pink, green: **3 visible colors** | **Confirmed, sampled clip**; this is the April recording's L2. | [Level 2 clip][M-video2] |
| Marble Sort, lives | **5 maximum** in the inspected ending/map clip | **Confirmed, visual for recorded build**; refill time untested. | [Level 18 ending][M-video3] |
| Marble Sort, content additions | Updates frequently advertise **80 levels**; earlier April updates advertised **40** | **Confirmed, update-note claims**, not a count of unique playable levels. | [iOS history][M-ios], [archived April/May notes][M-pereira] |

### 2.2 Timing and level pacing

| Observation | Number | Confidence / what it actually measures |
| --- | --- | --- |
| Loop Sort L21→22 chapter interval | **144 s** | **Confirmed, listed timestamps**, not a stopwatch measurement of pure gameplay. [YouTube chapter description][L-video21] |
| L22→23 / L23→24 / L24→25 | **55 / 78 / 96 s** | **Confirmed, arithmetic** from chapter starts. May contain transitions or edits. [Same description][L-video21] |
| L25→26 / L26→27 / L27→28 | **169 / 135 / 108 s** | **Confirmed, arithmetic**, same limitation. [Same description][L-video21] |
| L28→29 / L29→30 | **131 / 153 s** | **Confirmed, arithmetic**, same limitation. [Same description][L-video21] |
| Loop Sort sample pacing | **55–169 s**, median **131 s**, across those nine intervals | **Implied** rough scale of recorded early play, not a population average or retention metric. [Same video][L-video21] |
| Loop Sort taps per level | **Unknown** | **Guessed/unmeasured**. A walkthrough instruction can encompass several taps. [Layered example][L-167] |
| Marble Sort L1 recorded play | Roughly **26 s** from tutorial-ready opening through the final delivery/result transition; **6 source releases** implied by six emptied sources | **Confirmed, sampled clip timing**, about ±1 s; **Implied** tap count because not every finger contact is visible. [29.02-second clip][M-video1] |
| Marble Sort waiting at funnel | Red visible at mouth at **2 s**, **3 s**, and still partly at **7 s** | **Confirmed, sampled frames**; does not identify individual marbles or imply a fixed five-second timer. [Level 2 clip][M-video2] |
| Marble Sort late cleanup | About **4 s** for the recorded final few groups, then result UI | **Confirmed, sampled ending**; remaining marbles make another circuit instead of instant completion. [Level 18 clip][M-video3] |
| Marble Sort belt lap / intake cadence | **Unknown as a stable setting** | **Guessed/unmeasured**. A few-second circuit is visually plausible, but no fixed production value is established. [Ending clip][M-video3] |
| Both games: tap latency, dump duration, refill animation, grace period | **Unknown** | **Guessed/unmeasured**. Neither publisher supplies a timing spec. [Loop Sort][L-publisher], [Marble Sort][M-publisher] |

**Confirmed, attribution:** Tom Storr describes Loop Sort's conveyor as slow and levels as feeling long; this agrees with the scale of the chapter intervals without proving the game uses any particular speed. [Hands-on post][L-storr]

### 2.3 Difficulty ladder and obstacles

#### Loop Sort

| Feature | Established behavior | Confidence / evidence |
| --- | --- | --- |
| Hidden Blocks | Concealed cargo is revealed to continue. Exact exposure trigger needs play. | **Confirmed** feature, **Guessed** precise trigger: [publisher][L-publisher] |
| Curtains | Sorting the demanded color lifts the cover. | **Confirmed:** [publisher][L-publisher] |
| Ice Blocks | Ice must be broken to free cargo; hit count and whether adjacent completion or another event breaks it are unspecified. | **Confirmed** obstacle, **Guessed** hit rule: [publisher][L-publisher] |
| Barriers | Cargo may enter but cannot leave the fenced container. | **Confirmed:** [publisher][L-publisher] |
| Mixed cargo | Multi-color starting contents already occur in early promotional layouts; this does not establish a distinct “multi-color truck” special type. | **Confirmed, visual / Guessed special-type interpretation:** [Level 7][L-shot7] |
| Geometry | Figure-eight and perimeter arrangements alter arrival order; trucks face different ways. | **Confirmed, visual:** [Level 9][L-shot9], [actual orientation examples][L-orient] |
| Difficulty growth | More colors, concealed layers, spatial orientation and competing receivers plausibly raise planning difficulty. A single monotonic count ladder is unproven. | **Implied:** [L174 guide][L-174], [L393 shutter guide][L-393] |
| “Lever” | A Tricky Story L3 guide says “blue lever.” Its introductory rules still say tap trucks. No separate lever is established. | **Confirmed wording; Guessed mechanic:** [guide][L-lever] |

**Guessed, likely explanation:** “lever” is loose or erroneous walkthrough language for selecting a truck/source. Do not implement a physical switch, route reversal or timed lever on this evidence alone. [Conflicting terminology on the same page][L-lever]

#### Marble Sort: official release-note behavior

Each row below is **Confirmed as a published feature description**, not a fully reverse-engineered implementation. Dates are iOS-history dates where given, not verified first introduction levels. [Official history][M-ios]

| Update / feature | Published behavior, paraphrased | Evidence |
| --- | --- | --- |
| April: Tri Color / Trio Box | Three colors in one source. | **Confirmed:** [Archived notes][M-pereira] |
| April: Color Panel | Matching trays opens the panel. | **Confirmed:** [Archived notes][M-pereira] |
| April: Ice Trays | Frozen-tray obstacle; thaw trigger unstated. | **Confirmed:** [Archived notes][M-pereira] |
| May: Pillar | Nearby box choices shrink it. | **Confirmed:** [Archived notes][M-pereira] |
| May: Swap Box | Opening timing matters; exact cycle unspecified. | **Confirmed:** [Archived notes][M-pereira] |
| May: Knit Customers / Knit Trays | Unravel covering to free receivers/content. | **Confirmed:** [Archived notes][M-pereira] |
| May: Light Marbles | Complete their set to release a seal. | **Confirmed:** [Archived notes][M-pereira] |
| 3 June: Glass Tunnel / Piñata | Preview incoming box / break for hidden boxes. | **Confirmed:** [iOS history][M-ios] |
| 18 June: Multi Arrows / Rocket | Direction dependencies / instantly clears a box. | **Confirmed:** [iOS history][M-ios] |
| 1 July: Bubble Marbles / Double Box | Slow floating physics / nested box. | **Confirmed:** [iOS history][M-ios] |
| 16 July: Laser / Jelly | Alternates each turn / needs matching color. | **Confirmed:** [iOS history][M-ios] |
| 3 August: Rock Trays / Hooks | Reveal by breaking / release trapped boxes. | **Confirmed:** [iOS history][M-ios] |
| 12 August: Bush / Giant Bag | Shrink cover / fill bag to reveal tray. | **Confirmed:** [iOS history][M-ios] |
| 9 September: Rock Box / Fridge | Smash rock / break glass to free boxes. | **Confirmed:** [iOS history][M-ios] |
| 25 September: Bomb Marbles / Mini Gates | Collision scatters neighbors / small travel gate. | **Confirmed:** [iOS history][M-ios] |
| 8 October: Package / Rope | Specific-color opening / connected receivers must reach top. | **Confirmed:** [iOS history][M-ios] |
| 22 October: Tall Box / Flex Elevator | Double batch / whole floor rises when cleared. | **Confirmed:** [Android update][M-play] |

**Guessed/unresolved:** exact trigger counts and turn/timing semantics still need capture; names alone are insufficient. [Official history][M-ios]

#### Marble Sort: useful but unverified fan-rule details

| Feature | Fan description | Confidence / evidence |
| --- | --- | --- |
| Mystery / hidden sources | Reveal when the blocking/nearby box clears; some pages instead say dropping reveals it. | **Implied; conflicting:** [feature index][M-features] |
| Connected Box | Tapping either linked source dumps both. | **Implied:** [feature index][M-features]. |
| Arrow Box | First release the source its arrow points toward. | **Implied:** [feature index][M-features] |
| Multiplier Gate | Doubles passing marbles; magnifies overflow risk. | **Implied:** [feature index][M-features]; **Confirmed, visual** ×2 banner in [official artwork][M-shot2]. |
| Frozen receiver / Ice Box | Two nearby box actions thaw it. | **Implied**, action versus receiver-clear terminology is inconsistent: [feature index][M-features]. |
| Crates | Three nearby box actions open one. | **Implied**, trigger requires capture: [feature index][M-features]. |
| Pins / keys / locked pallet | Release source at pin head; carry key to unlock blocked content. | **Implied:** [feature index][M-features] |
| Elevator / Connected Pallet | Clear a linked receiver set before the next floor rises. | **Implied:** [feature index][M-features] |
| Center tunnels | Numbered buffered contents, unlocked/decremented by local progress. | **Implied; do not treat as belt teleporters:** [L21 guide][M-21]. |

**Implied, early progression:** one analyst deck places hidden sources around L5 and tunnels around L10. Its graph shows 6 sources in L1–2, about 16–17 in L7–10, and an uneven 18–40 in L31–40. **Guessed:** these are not a verified current-build curriculum; the deck also misdescribes a source as containing a single marble, contrary to its own imagery. [Deck][M-nbg], [source-count graph][M-nbg-count]

**Confirmed, reviewer/press reports rather than universal thresholds:** an April article found the first 30 levels relatively gentle and cited complaints of a spike around 70; later Android reviews report frustration after 60. Level numbering and offers change between versions. [Chinese article][M-baijing], [Android reviews][M-play], [Reddit level mismatch reports][M-reddit]

## 3. Feel and presentation: what the browser version would need to reproduce

### 3.1 Loop Sort

- **Confirmed, visual:** high, nearly overhead view; shallow visible vehicle sides; purple rails and truck shells; dark indigo ground; bright rounded cargo portions. The belt can encircle the trucks or sit between groups. This is a tabletop sorting machine, not a realistic driving simulation. [Official Level 48 frame][L-shot48], [orientation examples][L-orient]
- **Confirmed, visual:** tiny glossy cubes occupy an appreciable belt width and gather irregularly around bends; incoming particles rebuild a much larger coherent cargo portion. **Implied:** fragmentation followed by reconstruction provides a stronger before/after payoff than moving one solitary cube per tap. [Actual-play frames][L-actual], [promotional intake frame][L-shot7]
- **Confirmed, analyst framing:** Gamigion identifies the attraction as one input causing many automatic outcomes. **Implied:** the player chooses an intention and then watches a machine perform it; object density, overlapping streams and clear receiver feedback are central to the feel. [Gamigion introduction][L-gamigion]
- **Confirmed, visual:** check marks and brief particles/confetti mark completion in inspected frames; arrows and hands in store artwork explain motion. **Guessed:** those overlay arrows are promotional aids, not necessarily gameplay controls. [Level 20 promotional frame][L-shot20], [actual checks][L-actual]
- **Confirmed, reviewer reports:** slow animation, unclear failure and intrusive offers can break the otherwise relaxing rhythm. **Implied:** legible intake direction and explicit capacity feedback matter as much as bright materials. [Tom Storr][L-storr], [Reddit pacing complaint][L-reddit]
- **Guessed/unverified:** exact camera projection/FOV, ramps' collision shapes, engine audio, per-cube click sounds and haptic envelopes. No reliable source inspected establishes those settings for Garawell's game. Haptics advertised by an unrelated Unity template must not be attributed to Voodoo. [Original visual reference][L-shot48], [separate template][C-unity]

### 3.2 Marble Sort!

- **Confirmed, visual:** portrait screen with source board above, converging open hopper in the middle, short horizontal oval belt, and receiver columns below. Saturated glossy spheres, rounded plastic trays, soft shadows and restrained blue/purple backdrops make the machine readable. [Official frame][M-shot2]
- **Confirmed, sampled video:** a closed source tile opens into a visible batch; the marbles fan out, bounce, settle toward the funnel and trickle into moving spaces. **Implied:** free fall should remain visible rather than teleporting the batch directly into uniformly filled belt slots. [Level 2 clip][M-video2]
- **Confirmed, analyst observation:** AppMagic specifically highlights out-of-order landing as the differentiator from Pixel Flow and Sand Loop. **Implied:** useful uncertainty comes from local collisions; it need not imply randomized level layouts or arbitrary target requests. [AppMagic][M-appmagic]
- **Confirmed, publisher claim:** the intended ASMR feedback includes dropping, clinking and neatly seating marbles. **Confirmed, reviewer report:** Maya66 specifically likes funnel timing and calls the ASMR label accurate. **Guessed:** no exact sound library, pitch progression, music mix or haptic pulse pattern was verified. [Publisher][M-publisher], [review archive][M-apprecs]
- **Confirmed, sampled video:** a receiver fills, lifts away with a small sparkle, and reveals the next request; the final cleanup still takes travel time. **Implied:** completion feels like many small orderly resolutions, not one large explosion. [L1 clip][M-video1], [L18 ending][M-video3]
- **Confirmed, attributed criticism:** Baijing found the physical detail good but the payoff softer than Pixel Flow's shooting; the game does not suddenly accelerate its final cleanup. **Implied:** patient motion is part of its intended appeal, but excessive waiting can reduce the perceived reward. [Chinese analysis][M-baijing]
- **Confirmed, version-specific complaints:** a review aggregator records objections to sources bouncing when becoming available and to harder color discrimination after an update. **Implied:** adding more motion everywhere can undermine the calm, readable machine. [AppWolf review by Laura_Mae03, v1.22.01][M-wolf]
- **Confirmed, reviewer reports:** frustration includes hidden colors, unexpected release order and costly recovery. These establish perceived unfairness, not that all late levels require payment. [UK reviews][M-ukreviews]

### 3.3 Shared design inference

**Implied:** the common satisfying sequence is **read an accessible source → make one small tap → release many objects → follow continuous motion → watch automatic matching consolidate them → expose the next choice**. Space makes motion consequential: unmatched objects remain visible as a future problem. **Guessed, adaptation priority:** preserve that sequence before reproducing progression events, currency or decorative city maps. [One-input analysis][L-gamigion], [physics analysis][M-appmagic], [family rules][C-master]

## 4. Advertising analysis

### 4.1 Loop Sort copy: provenance matters

**Guessed/unverified attribution:** the task supplied the following alleged Voodoo creative copy; an accessible matching ad record was not located:

> Experience the ultimate truck puzzle challenge. Can you sort them all and clear the line?

**Confirmed, close official wording:** Voodoo's page calls it a truck puzzle and promises automatic sorting and line clearance. SocialPeta archives creatives under VOODOO SAS with the wording “One tap, endless fun!” and truck-to-conveyor instructions. This supports the broad pitch, not the exact supplied sentence's provenance. [Publisher][L-publisher], [ad archive][A-socialpeta]

**Implied, copy interpretation:** “truck” supplies a familiar toy/container metaphor; “sort them all” gives an immediately understandable completeness goal; “clear the line” promises visible relief from congestion. The rhetorical challenge encourages the viewer to mentally choose the next tap. This is a design interpretation, not measured click-through evidence. [Official pitch][L-publisher], [ad analysis][A-pereira]

### 4.2 What accessible ad evidence shows

| Creative family | Frames / sequence supported by sources | Confidence and interpretation |
| --- | --- | --- |
| Machine-only gameplay | A Chinese ad-selection collage includes small loop boards, perimeter and heart-shaped tracks, brightly colored containers, and cube streams; another tile foregrounds a toy purple truck. | **Confirmed, inspected collage. Implied:** repeated layouts sell the sorting process without explanation-heavy narrative. [ADX collage reproduced in analysis][A-collage] |
| Disassembly / rebuilding | The Chinese article describes ads foregrounding automatic sorting and the transformation between coherent cargo and many small pieces. | **Confirmed, attributed description. Implied:** disorder-to-order transformation offers a visible payoff after very little input. [Article][L-sohu] |
| Building-roof overload | Carlos Pereira describes gameplay inset into a realistic rooftop; crowding bends/collapses the structure and triggers an alarm; successful sorting restores it; overload can culminate in an explosion. | **Confirmed, analyst report, not directly watched here. Implied:** this externalizes abstract capacity as an obvious physical danger. [Original analyst post][A-pereira] |
| Variants and UGC | Pereira reports multiple container/item treatments, with and without explosion, plus UGC variants. | **Confirmed, reported by analyst**; not proof those are normal in-game levels. [Post][A-pereira] |
| Long demonstration and playable | SocialPeta lists video samples around 53–60 seconds, a 118-second example, and playable formats. | **Confirmed, archive metadata**; runtime does not establish a level's actual duration or ad effectiveness. [Archive][A-socialpeta] |

**Implied, why engaging:** broad streams make even a small action appear productive; a one-way route creates anticipation of the next matching intake; near-full occupancy supplies a visible failure threat; filling a truck resolves several competing objects at once. These hypotheses fit the accessible creative descriptions and auto-sort analysis; no A/B conversion data was available. [Pereira][A-pereira], [Gamigion][L-gamigion]

**Guessed/unverified:** the owner's observed “full truck drives away” may be a particular ad, version or clone. Store imagery also shows completed trucks still parked. A browser adaptation should not treat an ad-only roof explosion or replacement-truck queue as a confirmed original rule. [Completed-truck screenshot][L-actual], [explicit departure in clone][C-truck]

### 4.3 Marble Sort ad evidence and the tactile hook

- **Confirmed:** Voodoo ran a dedicated Marble Sort creative contest whose terms specify **9:16**, **15–30-second** submissions and live performance evaluation. This establishes active creative experimentation, not the success of any particular visual. [Voodoo terms, 29 May 2026][A-contest]
- **Confirmed, attributed secondary report:** a Chinese creative teardown groups openings into trays, long tubes, studded/brick-like boards and block walls, while retaining the loop and collection boxes; it also describes failure/challenge copy. Its exposure estimates were not independently audited. [Creative teardown][A-marble]
- **Implied:** changing the source container creates curiosity about how it releases, while retaining the same readable payoff: a colorful batch falls into a funnel and resolves into tidy boxes. These alternate source machines are creative variants, not proof of live obstacles. [Same teardown][A-marble], [publisher's actual core loop][M-publisher]
- **Confirmed, reviewer report:** one Android reviewer says the game matches the ads they saw. **Guessed:** that cannot validate every creative or every advertised source shape. [Lauren Bruce, 28 April][M-play]
- **Implied:** the most transferable hook is the contrast between a disorderly physical pile and crisp three-slot packing. Sound can reinforce the tiny resolutions, while the funnel makes the next arrival uncertain enough to watch. [Publisher's audio positioning][M-publisher], [independent physics analysis][M-appmagic]

## 5. Clone / relative table: explicit rule statements

“Family” below means useful mechanical comparison, **not a proven code lineage or infringement claim**. Each row is **Confirmed as published description** unless a weaker status is given. Quotes are short excerpts; the remaining text paraphrases the listing.

| Game and identity | Rule statement from store / publisher / distribution listing | What it clarifies, and limits |
| --- | --- | --- |
| **Sand Loop: Color Sort Puzzle**, Voodoo, `com.pc.sand.loop` | “Tap to release a bucket”; moving buckets collect matching sand until the artwork is cleared. The listing explicitly says no countdown timer. | **Confirmed:** the receiver moves, the sand picture is the source. **Implied:** gravity-driven depletion is its distinct feel; not Marble Sort's circulating loose-marble inventory. [Official Play listing][C-sand] |
| **Pixel Flow!**, Loom Games, `com.loomgames.pixelflow` | Send a colored pig onto the conveyor; it shoots matching pixels, spends numbered ammo, leaves when exhausted, or returns to one of **5 waiting slots** for relaunch. | **Confirmed:** queue and ammo management, not cargo flowing back into the original truck. Belt capacity can require waiting. [Official Play listing][C-pixel] |
| **Color Loop Match**, Huseyin Bener Bozkurt, iOS `6758606385`; its own copy also calls it **Loop Block Sort** | “Tap blocks to send them into the loop”; matching tiles remove them. Limited capacity; layered blocks take several steps; unknown blocks reveal upon placement; shutters restrict movement. | **Confirmed:** the listing uses both names. **Guessed:** no evidence that “Loop Block Sort” is a second separately identified app. [Official App Store listing][C-color] |
| **Loop Sort: Cube Match Puzzle**, nvkhuy, `com.nvkhuy.loopsort` | “Tap to Unload”; parked trucks release cubes to a moving belt, matching colors clears the line, complete clearance wins. Lists mystery blocks, curtains, ice and barriers. | **Confirmed:** close truck/obstacle framing. **Guessed:** listing does not specify exposed-run versus entire-truck release, receiver activation or truck capacity. [Official Play listing][C-nvkhuy] |
| **Sand Truck Puzzle**, Six Pawns, iOS `6757739374` | “Waiting trucks will only pick up sand that matches their color.” Tap a source truck to send sand to a capacity-limited belt; overfill loses; clear the sand-filled trucks. | **Confirmed as archived store text:** fixed-color waiting vehicles are explicit here. The original US Apple URL returned 404; the archive is not evidence of present availability. [Archived listing][C-sandtruck] |
| **Truck Sort**, Sanket Narola, browser distribution | “All matching cubes at the front leave together”; the belt seeks a truck with room showing that color. A full monochrome truck drives away; clear the yard to win. | **Confirmed listing rule:** excellent evidence for a clone's exposed-run release and departure. Lists Undo, Shuffle, belt-space and extra-truck tools; **100** levels. Do not automatically transfer departure into Garawell's build. [Distribution page][C-truck] |
| **Cargo Loop: Color Sort Puzzle**, Quest VR listing | “release its next cargo group”; parcels automatically move to appropriate trucks, while limited conveyor space makes release order consequential. Advertises **75 levels** and varying paths. | **Confirmed as store text mirrored by catalog:** VR tabletop relative, not an identified mobile predecessor. **Guessed:** group size and receiving tie-breaks are unstated. [Quest listing mirror][C-cargo] |
| **Loop Master: Color Jam Sort**, Pleasure City / Orange One, Android `com.loop.clear.cube.free.card.puzzle.sort.match`, iOS `6761603258` | Four matching cubes complete a crate. Pieces circulate until a matching crate opens. Full belt **and no useful move** ends the round. Undo returns a card; Shuffle changes one plank; Android Extra adds **2 capacity slots**. | **Confirmed:** distinguishes temporary saturation from a dead end, and group capacity from tiny visual cubes. Hidden lower colors appear in some levels. [Official Android description][C-master], [iOS listing][C-master-ios] |
| **Loop Sort Jam**, Arizona GS, `com.magritter.loopsortcl` | Automatic color pickup; concealed cubes reveal after front removal; covered trucks need their cover color; rocks allow entry but block exit until completion. Jam costs a life; lives refill over time. | **Confirmed as mirrored developer text:** the most explicit barrier/life description found. Original Play page could not be fetched, so treat current availability as **Guessed**. [Description mirror][C-jam] |
| **Car Sort: Color Puzzle**, Rollic, `com.duykanbakay.carconveyortransfer` | Tap to send cars around a track; match them into appropriate garages and clear the board. | **Confirmed:** vehicle-as-item variation. Listing is sparse about batch size and intake priority; its “Flip Cars” update suggests color changes, without a precise trigger. [Official Play listing][C-carsort] |
| **Loop Belt**, croko cat, browser | Top matching groups leave trays; matching top-color trays receive them; **four** complete a tray; empty trays take a color; limited belt can overflow. | **Confirmed, developer description:** close, unusually explicit reference model. Author names Loop Master, CarLoop and Pixel Flow as inspirations; this is not proof of Garawell's rules. [Developer page][C-loopbelt] |
| **Truck Loop Sort 3D**, commercial Unity template | Tap trucks to drop blocks; cubes jump into same-color trucks; fill every truck; avoid jamming the belt. | **Confirmed sales description:** gives target/win/fail wording, but no proof of original-game capacity or behavior. [Codester listing][C-codester] |
| **Loop Sort**, Mahad Shabbir's Unity template, separate product | Matching fruit groups shatter into cube fragments, circulate, then reconstruct in trays. Jam loses; includes portals, Undo, Ghost Slot and Magnet Core. | **Confirmed developer description:** explicitly documents fragmentation/reconstruction, haptics and audio in **this template**. It is not the Voodoo game. [Developer announcement][C-unity] |
| **Balls Factory 3D**, Microdose, `com.microdose.ballfactory`, iOS `6747108778` | Match balls into boxes; a pinball machine can send them back to the board. | **Confirmed store rule; Implied family relevance:** same developer and physical sorting. A Chinese analysis identifies it as an earlier related experiment; no verified direct code ancestry. [Official Play listing][C-factory], [Chinese analysis][M-baijing] |
| **Marble Sort**, GameBerry Studio, browser distribution | Release upper colored groups through a funnel; lower matching trays receive them; later levels add colors. | **Confirmed distribution description:** useful browser relative, but do not confuse its counts or timings with Microdose's app. [Provider-identifying listing][C-marbleweb] |

**Confirmed false-friend warning:** the store description of **Car Loop: Traffic Flow Puzzle** (`com.game.car.loop.traffic.escape`) describes rotating roads between islands, not this cargo auto-sort. A similar title alone cannot identify the “Car Loop” named in industry commentary. [Official listing][C-carloop-other], [family commentary][L-gamigion]

## 6. Conflicts, source quality, and gameplay-capture questions

### 6.1 Conflicts that should remain visible

| Conflict | Research conclusion |
| --- | --- |
| Body-color matching versus exposed-color matching | **Implied:** exposed cargo is the stronger original-game model. Same-purple trucks and mixed cargo contradict a universal body-color rule. Fixed-color waiting trucks are explicitly documented in Sand Truck Puzzle. [Original image][L-shot7], [analysis][L-sohu], [clone][C-sandtruck] |
| Whole mixed truck versus front matching run | **Implied:** original visual evidence and explicit Truck Sort rules favor a run. An APK article asserts whole-stack release without adequate capture; do not promote it to fact. [Visual][L-shot9], [clone][C-truck], [contrary article][L-apk] |
| Completed truck departure | **Confirmed:** parked checks exist in original screenshots; **Confirmed:** a clone promises departure. **Guessed:** when/if Garawell's finished trucks later drive away or reveal replacements. [Original][L-actual], [clone][C-truck] |
| Belt capacity versus visual particle density | **Implied:** Loop Sort's HUD may count logical portions, while many tiny cubes depict one portion. Marble Sort's reported 21 is a separate claim. Neither game's displayed object count should be copied across modes. [Loop analysis][L-sohu], [Marble count][M-baijing] |
| Marble Sort source contains one marble | **Confirmed:** an analyst deck says this while showing multi-marble sources. Prefer the official image's visible 3×3 batch; preserve the deck only as attributed, lower-confidence progression evidence. [Deck][M-nbg], [official image][M-shot1] |
| “Full belt always loses” | **Confirmed:** official Marble Sort wording also requires no matching box. Headlines and simplified fan tips often omit the second condition. [Official rule][M-play], [simplified portal description][M-yayoye] |
| Deterministic versus random | **Implied:** authored layouts can be repeatable while physical arrival order varies. “Random first attempt” criticism need not mean random puzzle generation. [AppMagic physics discussion][M-appmagic], [Loop Sort hands-on criticism][L-storr] |
| Walkthrough level numbers / colors | **Confirmed, player reports:** guides and installed builds can differ by level number and palette. Capture version, platform and opening layout, not level number alone. [Reddit reports][M-reddit] |
| Tunnel rules | **Confirmed:** a fan index's card and FAQ describe tunnels differently, while screenshots show numbered sources. **Guessed:** exact decrement event and whether it is local or global. [Fan index][M-features], [official image][M-shot1] |
| “Lever” as a new system | **Guessed:** unsupported. Do not make a route-switching control from one walkthrough's terminology. [L3 text][L-lever] |

### 6.2 What was accessible, and what was not

- **Confirmed, source quality observation:** Voodoo/store text establishes headline rules and named obstacles, but omits capacities, collision constants and most trigger counts. The histories offer feature names with only short descriptions. [Loop Sort publisher][L-publisher], [Marble Sort history][M-ios]
- **Confirmed, source quality observation:** the Gamigion article advertises a first-100-level breakdown, but the accessible page stops at a subscription/free-reading gate before the promised raw breakdown. No unpublished spreadsheet values are used here. [Article][L-gamigion]
- **Confirmed, source quality observation:** Tricky Story's L3 uses “lever”; later pages offer generic steps about trajectories and intersections. These are leads to linked videos, not sufficient evidence for new mechanics. [L3][L-lever], [L500][L-500]
- **Confirmed, source quality observation:** AAYYY's Loop Sort guide discusses rings and pegs; this conflicts with the identified truck game and is excluded as mechanical evidence. [Example][L-badguide], [original listing][L-play]
- **Confirmed, source quality observation:** NextBigGames' page labels its Marble Sort article as Yarn Flow in a subtitle and some slide text contradicts the pictured sources. Its count chart is retained only as an analyst claim. [Page/deck][M-nbg]
- **Confirmed, research limitation:** YouTube titles/descriptions/chapter times were accessible; a linked video fetch was throttled. SocialPeta exposed creative metadata, but its media CDN returned 403 during direct retrieval. Thus this report does **not** claim full frame-by-frame viewing of those videos or ads. [Video listing][L-video21], [ad archive][A-socialpeta]
- **Confirmed, scope of inspected video:** the three directly sampled clips were publicly embedded by Baijing; their content shows L1, a partial L2 sequence, and an L18 ending. Their container durations are approximately 29.02, 18.55 and 12.72 seconds. Those durations are **not three level-length measurements**. [Clip 1][M-video1], [clip 2][M-video2], [clip 3][M-video3]
- **Confirmed, source coverage:** AppFollow and Sensor Tower public pages mainly expose listings/market metadata; Friendly GameDev and Naavik provide genre context. No precise intake timing or capacity spec was found there. No usable detailed breakdown was obtained from the requested GameLook/Youxiputao, GameRefinery, Deconstructor of Fun or named specialist subreddits. [AppFollow][R-appfollow], [Sensor Tower][R-sensor], [Friendly GameDev][R-friendly], [Naavik][R-naavik]
- **Confirmed, source independence warning:** Huxiu and English/other syndications repeat Baijing's article; localized fan pages repeat their own English guides. They are not independent confirmations of 9/21/3 or of a disputed trigger. [Original][M-baijing], [Huxiu syndication][M-huxiu], [English retelling][R-translation]

### 6.3 Open questions only a controlled gameplay capture can settle

Every item is **Guessed/unresolved**. The linked evidence identifies why the question matters; it does not answer it.

| Priority | Capture / experiment | What it would settle |
| --- | --- | --- |
| P0 | Record a mixed truck before/after one tap, with adjacent repeated colors and a different color behind. | Exact run size; whether release can span multiple colors or partial portions. [Reference][L-shot9] |
| P0 | Leave a never-tapped truck with a free space; send exposed-color and nonmatching cargo past it. Repeat with an empty truck. | Passive intake, dynamic color establishment, and any activation rule. [Reference][L-sohu] |
| P0 | Put two same-color trucks at different route positions, one nearly full, plus an empty truck. | Nearest intake versus global matching priority; build change behind the May complaint. [Reference][L-play-old] |
| P0 | Tap a partly refilling truck while cargo is in transit, then tap again immediately. | Self-recapture, input lockout and authoritative state during reconstruction. [Player inconsistency report][L-reviews] |
| P0 | Complete a truck and keep recording until the next decision and level end. | Check lockout, departure timing, replacements and lane advancement. [Reference][L-actual] |
| P0 | Saturate each belt while a compatible receiver can still drain; then repeat with none available. | Exact fail predicate, grace duration, occupancy units, pending-funnel accounting. [Loop reference][L-storr], [Marble rule][M-play] |
| P0 | In Marble Sort, count admissions until blocked, keeping visible hopper inventory separate. | Current-build capacity; whether 21 is constant, level-specific or outdated. [Reported number][M-baijing] |
| P1 | Track one marked marble around an otherwise empty loop, then repeat at high occupancy. | Belt speed, lap time, density-dependent slowing and actual intake distance. [Loop speed report][L-sohu], [Marble ending][M-video3] |
| P1 | Trigger two source boxes at controlled 100–500 ms separations. | Cooldown, permitted overlap and whether the funnel physically or scriptedly meters admission. [Overlap evidence][M-appmagic] |
| P1 | Film a complete receiver queue including simultaneous column completions. | Local queue advancement, same-frame reservations, pickup precedence and animation delays. [Reference][M-video1] |
| P1 | Inspect ordinary and Tall Box source counts in the same build. | Absolute 9/18 counts and whether tall means height, batch size, or both in its presentation. [Official doubling][M-play] |
| P1 | Introduce each obstacle alone and annotate the triggering action. | Ice count, curtain/cover color quota, barrier completion, tunnel countdown, key handling and hidden-source reveal. [Loop obstacles][L-publisher], [Marble fan index][M-features] |
| P1 | Capture newer Laser, Jelly, Rope, Hook, Package, Mini Gate and Flex Elevator tutorials. | Turn versus time cycles and precise source/receiver relationships missing from notes. [History][M-ios] |
| P1 | Log 10 early, 10 middle and 10 late levels, with versions, source counts, colors, taps and active play time. | Real pacing/density distribution; avoid equating edited chapter intervals with levels. [Available intervals][L-video21] |
| P1 | Capture device audio directly; separately record settings and hand/phone feedback. | Actual sound palette, music, haptic triggers/intensity and mute behavior. [ASMR promise][M-publisher] |
| P2 | Preserve the exact original ad URL/id and record first frame, release, intake, completion and failure. | Supplied copy, body-colored variants, truck departure, roof danger and any literal lever. [Available ad description][A-pereira], [ambiguous lever text][L-lever] |

## Source URLs

Primary listings, publisher pages and first-party media:

[L-play]: https://play.google.com/store/apps/details?id=com.Garawell.LoopSort&hl=en_US
[L-ios]: https://apps.apple.com/us/app/loop-sort/id6751101794
[L-publisher]: https://voodoo.io/games/loop-sort
[L-shot7]: https://play-lh.googleusercontent.com/hQjiK5pNPz1O4s1C1NS0nOhVq3YzKbiAZUneIYbAQSUMRpXu6wedjxlk1XcRFNOcvVlqO_1-4SJP7bqsrz0j_A=w1000
[L-shot9]: https://play-lh.googleusercontent.com/9f21OzmAAxdKT-bdDpJaEF9n9IzCwe429HEUkcMPtN51RdNbzqtx-QQ9JZpV-uA2mSX7jrP1HAXej0RbgJVmvg=w1000
[L-shot20]: https://play-lh.googleusercontent.com/nOSIC1GaAZNJ-mfuGWbHjSqROzAqbOPXTGVCP1coodfeT8h-L8dFBKstdkQBR-WUd83IfTeuUm10hbG4SKOE=w1000
[L-shot48]: https://play-lh.googleusercontent.com/pQzC56ime-Uk7s3VdGWDDZxdnkmJd3zL0ALptU_YUYhOF7XTL8w7npkPHMTbBaNEPdRLQRuuBOJ7djGLumy9TH4=w1000
[M-play]: https://play.google.com/store/apps/details?id=com.microdose.balljam&hl=en_US
[M-ios]: https://apps.apple.com/us/app/marble-sort-color-puzzle/id6754558455
[M-publisher]: https://voodoo.io/games/marble-sort
[M-class]: https://www.classification.gov.au/titles/marble-sort-0
[M-shot1]: https://play-lh.googleusercontent.com/tObmaGAHrAaXBjsX7tWXAw1qIG6CjBbLEoH-jCRgBB-SpHcLorUIG_9OszyiuxYEY8FIagbmqamT6csdeZsQJg=w1000
[M-shot2]: https://play-lh.googleusercontent.com/fqSa297Kwlb3kNqLHsxEL8TU41_5YqYEDBDE0Q_zlymPd7LrEsrmEqf02rPZRFGxRLyusi3HOGU_JNC4KIeC9w=w1000
[M-video1]: https://www.baijing.cn/ueditor/php/upload/video/20260420/1776684181152562.mp4
[M-video2]: https://www.baijing.cn/ueditor/php/upload/video/20260420/1776684487523289.mp4
[M-video3]: https://www.baijing.cn/ueditor/php/upload/video/20260420/1776684557402102.mp4

Analyses, reviews, walkthroughs and ad records:

[L-sohu]: https://m.sohu.com/a/1045496640_100136645
[L-actual]: https://q8.itc.cn/images01/20260703/14de19e47d5641fda58ed9ce1b11d59e.png
[L-orient]: https://q6.itc.cn/images01/20260703/d8bc1e33915c47b9a3eb013f89d17048.png
[L-gamigion]: https://gamigion.substack.com/p/loop-sort-level-deconstruction-1
[L-storr]: https://www.linkedin.com/posts/tomstorr_garawell-games-loop-sort-earned-12m-in-activity-7503342720669761536-cRJa
[L-play-old]: https://play.google.com/store/apps/details?id=com.Garawell.LoopSort
[L-reviews]: https://www.iofreeonline.com/IOS/game/Loop-Sort.html
[L-wolf]: https://appwolf.io/apps/loop-sort
[L-reddit]: https://www.reddit.com/r/SwagBucks/comments/1w9xu7b/loop_sort_sept_2026_avoid/
[L-hub]: https://levelsolve.com/loop-sort/
[L-1]: https://levelsolve.com/loop-sort/level/1/
[L-2]: https://levelsolve.com/loop-sort/level/2/
[L-3]: https://levelsolve.com/loop-sort/level/3/
[L-167]: https://levelsolve.com/loop-sort/level/167/
[L-174]: https://levelsolve.com/loop-sort/level/174/
[L-393]: https://levelsolve.com/loop-sort/level/393/
[L-lever]: https://trickystorywalkthrough.com/loop-sort-level-3-walkthrough/
[L-500]: https://trickystorywalkthrough.com/loop-sort-level-500-walkthrough/
[L-video21]: https://www.youtube.com/watch?v=oucqTOViFec
[L-apk]: https://oyunclubnet.com/loop-sort/
[L-badguide]: https://www.aayyy.com/loop-sort/how-to-solve-level-332-pro-strategies-clearing/
[M-baijing]: https://www.baijing.cn/article/55165
[M-huxiu]: https://www.huxiu.com/article/4852236.html
[M-appmagic]: https://appmagic.rocks/blog/voodoo-new-big-three
[M-priyanath]: https://www.linkedin.com/posts/kavindu-priyanath_gamedesign-mobilegames-gamingindustry-activity-7445799563421990912-HtT0
[M-pereira]: https://carlospereiragame.substack.com/p/4-may-liveops-and-updates
[M-nine]: https://marblesort.org/guides/nine-marble-remainder/
[M-features]: https://marblesort.org/features/
[M-21]: https://marblesort.net/level/21/
[M-apprecs]: https://apprecs.com/ios/6754558455/marble-sort%21
[M-nbg]: https://nextbiggames.com/2026/04/21/marble-sort-by-voodoo-game-breakdown/
[M-nbg-count]: https://nextbiggames.com/wp-content/uploads/2026/04/image-12-2.png
[M-wolf]: https://appwolf.io/apps/marble-sort
[M-ukreviews]: https://apps.apple.com/gb/app/marble-sort/id6754558455?platform=iphone&see-all=reviews
[M-reddit]: https://www.reddit.com/r/MobileGames/comments/1vnb3bh/marble_sort_help/
[M-yayoye]: https://yayoye.com/game/marble-sort
[A-pereira]: https://www.linkedin.com/posts/carlospereiragame_hybridcasual-ads-loop-sort-by-voodoo-after-activity-7503376663808983041-ad74
[A-collage]: https://q8.itc.cn/images01/20260703/ba1f1e19245d47dc84e2bc6b2a71e520.png
[A-socialpeta]: https://socialpeta.com/en/google-play/com.Garawell.LoopSort
[A-contest]: https://voodoo.io/creative-contest/terms
[A-marble]: https://www.yeyulingfeng.com/a/1229959.html

Clone and relative listings:

[C-sand]: https://play.google.com/store/apps/details?id=com.pc.sand.loop&hl=en
[C-pixel]: https://play.google.com/store/apps/details?id=com.loomgames.pixelflow&hl=en
[C-color]: https://apps.apple.com/us/app/color-loop-match/id6758606385
[C-nvkhuy]: https://play.google.com/store/apps/details?id=com.nvkhuy.loopsort&hl=en
[C-sandtruck]: https://appshunter.io/ios/app/sand-truck-puzzle/id6757739374
[C-truck]: https://playgama.com/game/truck-sort
[C-cargo]: https://queststoredb.com/game/cargo-loop-color-sort-puzzle-1338855102645771/
[C-master]: https://play.google.com/store/apps/details?id=com.loop.clear.cube.free.card.puzzle.sort.match&hl=en
[C-master-ios]: https://apps.apple.com/gb/app/loop-master-colour-jam-sort/id6761603258
[C-jam]: https://apkpure.net/loop-sort-jam/com.magritter.loopsortcl
[C-carsort]: https://play.google.com/store/apps/details?id=com.duykanbakay.carconveyortransfer
[C-loopbelt]: https://crokocat.com/game/loopbelt/
[C-codester]: https://server.codester.com/items/71963/truck-loop-sort-3d-puzzle-game-unity-source-code
[C-unity]: https://discussions.unity.com/t/launching-loop-sort-hyper-casual-puzzle-game-template-for-unity-6/1736632
[C-factory]: https://play.google.com/store/apps/details?id=com.microdose.ballfactory
[C-marbleweb]: https://kixo9.games/en-us/games/marble-sort/
[C-carloop-other]: https://play.google.com/store/apps/details?id=com.game.car.loop.traffic.escape&hl=en

Market-context sources checked; not used to infer numerical mechanics:

[R-appfollow]: https://apps.appfollow.io/android/marble-sort/com.microdose.balljam?country=it
[R-sensor]: https://app.sensortower.com/overview/6902a4b667bda8ceb5519d46/6754558455?country=WW
[R-friendly]: https://friendlygamedev.com/blog/state-of-hybrid-casual-puzzles/
[R-naavik]: https://naavik.substack.com/p/h1-2026-mobile-gamings-stability
[R-translation]: https://www.100user.com/blog/voodoo-marble-sort-revolutionizes-conveyor-belt-ga
