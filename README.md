# PAC-MAN 2027*

The arcade legend rebuilt: an arcade-faithful Classic mode plus a 2027 mode with ever-changing mazes, power-ups, combos, events, Battle against humanlike AI rivals and a Daily Run.

\*Fan-made tribute. PAC-MAN is a trademark of Bandai Namco Entertainment Inc. This project is not affiliated with or endorsed by them.

- **English only, school friendly, no sign-up, no ads, works offline.**
- **The only external host is `cdn.jsdelivr.net`** (Orbitron and Rubik fonts; system fonts are used if it is blocked). All graphics are drawn in code and all sounds are synthesized, so there are no image or audio files.

## Modes
| Mode | What it is |
| --- | --- |
| Classic | The original 28×31 maze, 240 dots + 4 energizers, arcade level tables (speeds, fright times, Cruise Elroy), scatter/chase timers, ghost-house dot counters, the four ghost personalities (including Pinky's and Inky's famous "up" quirk), fruit, bonus life at 10,000. |
| 2027 | A new procedurally generated maze and world theme every level, 7 power-ups, dot combos (up to x4), level events (Blackout, Ghost Rush, Gold Rush, Speed Run, Power Surge), extra lives every 40,000, Casual / Normal / Insane (Insane ghosts use real shortest paths). Normal has an adaptive director that eases off after deaths and pushes back when you play cleanly. |
| Battle | You vs 1–3 AI Pac-Men (Easy / Normal / Hard) for 2:30 in a shared maze with the ghosts. An energizer lets you eat rivals and steal points. Each bot has a personality (Greedy, Hunter, Cautious, Trickster) and shows emotes. |
| Daily Run | Everyone gets the same seeded mazes and events on the same day. One counted run, then practice. Builds a streak and has a share button. |

## Power-ups (2027, Battle, Daily)
Turbo (+35% speed), Magnet (pulls nearby dots), Freeze (ghosts freeze, touch to shatter), Shield (survive one hit), Shockwave (nearby ghosts turn blue), Phase (pass through ghosts), 2x Points.

## The AI
- **Ghosts** follow the arcade rules exactly: Blinky targets you, Pinky aims 4 tiles ahead, Inky mirrors Blinky through a point 2 tiles ahead of you, Clyde retreats when close. They never reverse except on mode changes, and they use the arcade's tie-break order and red zones.
- **AI Pac-Men** (Battle rivals and the menu demo) play like people. At each tile they weigh nearby dots and items against danger. When a ghost is close they "rehearse" the next 1–2.5 seconds: they replay the ghosts' real rules along each possible route and avoid the ones that end in a catch. Skill controls how far ahead they see, how often they slip and how fast they react.

## Progression
XP and levels with titles, coins, a garage/shop (9 colors, 9 hats, 6 trails, 7 maze themes for Classic; some unlock through achievements), 16 achievements, 3 daily missions, local high score tables with CPU legends, and lifetime stats. Everything is saved in the browser (localStorage).

## Controls
Arrows / WASD, P or Esc to pause, M to mute. On touch screens you can swipe anywhere; an on-screen D-pad appears automatically in portrait, or can be forced in Settings. Gamepads are supported. Turns pressed early are taken at the next corner, as in the arcade.

## Files and hosting
```
index.html        loads css/style.css and js/*.js
standalone.html   the whole game in one file (best for Google Sites "Embed code")
css/ js/          game files
src/              HTML template used by the build
build.js          rebuilds index.html + standalone.html
tests/            headless and browser tests
```
To load the game files from jsDelivr, run `node build.js owner/repo`. `index.html` then points to `https://cdn.jsdelivr.net/gh/owner/repo@main/css/…` and `…/js/…`. Upload `index.html`, `css/` and `js/` to the root of that repository.

## Tests
```
node tests/sim.test.js                                   # 300 generated mazes are valid; full games in every mode with the autopilot
NODE_PATH=$(npm root -g) node tests/browser.test.js     # plays every mode in Chromium, phone and short screens, no page scroll
PAGE=standalone.html NODE_PATH=$(npm root -g) node tests/browser.test.js
```
