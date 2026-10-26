/* PAC-MAN 2027* — rules, level tables, catalog */
(function (PM) {
  'use strict';

  /* ---------- arcade level table (speeds are fractions of PM.TPS) ---------- */
  const FRIGHT = [6, 5, 4, 3, 2, 5, 2, 2, 1, 5, 2, 1, 1, 3, 1, 1, 0, 1];
  const ELROY = [[20, 10], [30, 15], [40, 20], [40, 20], [40, 20], [50, 25], [50, 25], [50, 25], [60, 30], [60, 30], [60, 30],
    [80, 40], [80, 40], [80, 40], [100, 50], [100, 50], [100, 50], [100, 50], [120, 60]];
  PM.levelSpec = function (level) {
    const L = Math.max(1, level);
    const s = L === 1 ? { pac: 0.8, pacFright: 0.9, ghost: 0.75, tunnel: 0.4, ghostFright: 0.5, elroy1: 0.8, elroy2: 0.85 }
      : L <= 4 ? { pac: 0.9, pacFright: 0.95, ghost: 0.85, tunnel: 0.45, ghostFright: 0.55, elroy1: 0.9, elroy2: 0.95 }
        : L <= 20 ? { pac: 1, pacFright: 1, ghost: 0.95, tunnel: 0.5, ghostFright: 0.6, elroy1: 1, elroy2: 1.05 }
          : { pac: 0.9, pacFright: 0.9, ghost: 0.95, tunnel: 0.5, ghostFright: 0.6, elroy1: 1, elroy2: 1.05 };
    s.fright = L <= FRIGHT.length ? FRIGHT[L - 1] : 0;
    s.flashes = L === 9 || L === 12 || L === 13 || L === 15 || L === 16 || L === 18 ? 3 : 5;
    const e = ELROY[Math.min(L, ELROY.length) - 1];
    s.elroyDots1 = e[0]; s.elroyDots2 = e[1];
    // scatter / chase phases in seconds (Infinity = rest of the level)
    s.phases = L === 1 ? [7, 20, 7, 20, 5, 20, 5, Infinity]
      : L <= 4 ? [7, 20, 7, 20, 5, 1033, 1 / 60, Infinity]
        : [5, 20, 5, 20, 5, 1037, 1 / 60, Infinity];
    // ghost house: personal dot limits (pinky, inky, clyde) and the "pac stopped eating" timer
    s.dotLimits = L === 1 ? [0, 30, 60] : L === 2 ? [0, 0, 50] : [0, 0, 0];
    s.idleRelease = L <= 4 ? 4 : 3;
    return s;
  };

  PM.FRUITS = [
    { id: 'cherry', name: 'Cherry', points: 100 }, { id: 'strawberry', name: 'Strawberry', points: 300 },
    { id: 'orange', name: 'Orange', points: 500 }, { id: 'apple', name: 'Apple', points: 700 },
    { id: 'melon', name: 'Melon', points: 1000 }, { id: 'ship', name: 'Starship', points: 2000 },
    { id: 'bell', name: 'Bell', points: 3000 }, { id: 'key', name: 'Key', points: 5000 }
  ];
  const FRUIT_BY_LEVEL = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];
  PM.fruitFor = level => PM.FRUITS[level <= FRUIT_BY_LEVEL.length ? FRUIT_BY_LEVEL[level - 1] : 7];

  PM.GHOSTS = [
    { name: 'Blinky', nick: 'Shadow', color: '#ff3b5c', corner: [25, -4], home: [14, 11.5] },
    { name: 'Pinky', nick: 'Speedy', color: '#ff8ce6', corner: [2, -4], home: [14, 14.5] },
    { name: 'Inky', nick: 'Bashful', color: '#3be8ff', corner: [27, 31], home: [12, 14.5] },
    { name: 'Clyde', nick: 'Pokey', color: '#ffb347', corner: [0, 31], home: [16, 14.5] }
  ];

  /* ---------- modes ---------- */
  PM.MODES = {
    classic: { id: 'classic', name: 'Classic', icon: '🕹️', tag: 'Arcade-perfect', desc: 'The original maze, ghost brains and level tables. 3 lives, bonus life at 10,000.' },
    x27: { id: 'x27', name: '2027', icon: '🌀', tag: 'Evolving mazes', desc: 'A new generated maze and world every level, power-ups, combos and surprise events.' },
    battle: { id: 'battle', name: 'Battle', icon: '⚔️', tag: 'Vs AI rivals', desc: 'You vs up to 3 humanlike AI Pac-Men. Power up to eat rivals. Top score in 2:30 wins.' },
    daily: { id: 'daily', name: 'Daily Run', icon: '📅', tag: 'Same for everyone', desc: 'Today\'s seeded mazes and events. One run counts. Share your score.' }
  };
  PM.MODE_ORDER = ['classic', 'x27', 'battle', 'daily'];
  PM.DIFFICULTY = {
    casual: { name: 'Casual', ghost: 0.88, fright: 1.6, smart: false },
    normal: { name: 'Normal', ghost: 1, fright: 1, smart: false },
    insane: { name: 'Insane', ghost: 1.08, fright: 0.55, smart: true }
  };
  PM.BATTLE_TIME = 150;

  /* ---------- 2027 power-ups ---------- */
  PM.POWERUPS = {
    turbo: { name: 'Turbo', color: '#ffd23a', time: 6, desc: '+35% speed' },
    magnet: { name: 'Magnet', color: '#ff5a7a', time: 8, desc: 'Pulls in nearby dots' },
    freeze: { name: 'Freeze', color: '#8fe8ff', time: 4, desc: 'Ghosts freeze. Touch them to shatter.' },
    shield: { name: 'Shield', color: '#5dff9e', time: 15, desc: 'Survive one ghost hit' },
    shock: { name: 'Shockwave', color: '#b58cff', time: 0, desc: 'Ghosts nearby turn blue' },
    phase: { name: 'Phase', color: '#e6e6ff', time: 5, desc: 'Pass through ghosts' },
    double: { name: '2x Points', color: '#ffa23a', time: 10, desc: 'Double points' }
  };
  PM.POWERUP_ORDER = Object.keys(PM.POWERUPS);

  /* ---------- level events (2027 + Daily, from level 2) ---------- */
  PM.EVENTS = {
    none: { name: '', desc: '' },
    blackout: { name: 'BLACKOUT', desc: 'The lights are out. Stay close to the dots.' },
    rush: { name: 'GHOST RUSH', desc: 'Ghosts are faster. Ghost points x2.' },
    gold: { name: 'GOLD RUSH', desc: 'Grab the gold coins for shop money.' },
    speedrun: { name: 'SPEED RUN', desc: 'Clear the maze fast for a big time bonus.' },
    surge: { name: 'POWER SURGE', desc: 'Eight energizers in this maze.' }
  };
  PM.EVENT_POOL = ['none', 'none', 'blackout', 'rush', 'gold', 'speedrun', 'surge'];

  /* ---------- maze themes ---------- */
  PM.THEMES = {
    retro: { name: 'Retro', bg: ['#000000', '#000000'], wall: '#2b46ff', glow: '#2b46ff', fill: 'rgba(20,30,140,0.18)', dot: '#ffc8b8', door: '#ffb8ff', accent: '#ffe14d' },
    neon: { name: 'Neon City', bg: ['#0b0420', '#05010d'], wall: '#ff3fd8', glow: '#ff3fd8', fill: 'rgba(255,63,216,0.10)', dot: '#fff4a8', door: '#4ef2ff', accent: '#4ef2ff' },
    cyber: { name: 'Cyber Jungle', bg: ['#021a12', '#010a07'], wall: '#27ff9a', glow: '#27ff9a', fill: 'rgba(39,255,154,0.08)', dot: '#eaffc8', door: '#ffe14d', accent: '#ffe14d' },
    ice: { name: 'Ice Cavern', bg: ['#04162b', '#020a16'], wall: '#7fe7ff', glow: '#7fe7ff', fill: 'rgba(127,231,255,0.12)', dot: '#ffffff', door: '#c4b5ff', accent: '#c4b5ff' },
    lava: { name: 'Lava Core', bg: ['#1f0600', '#0c0200'], wall: '#ff6a1f', glow: '#ff3d00', fill: 'rgba(255,106,31,0.12)', dot: '#ffe0a0', door: '#ffd23a', accent: '#ffd23a' },
    space: { name: 'Deep Space', bg: ['#0a0420', '#020108'], wall: '#9b7bff', glow: '#7b5cff', fill: 'rgba(155,123,255,0.10)', dot: '#e8e0ff', door: '#ff8ce6', accent: '#ff8ce6', stars: true },
    gold: { name: 'Golden Arcade', bg: ['#140f00', '#060400'], wall: '#ffd34d', glow: '#ffb000', fill: 'rgba(255,211,77,0.10)', dot: '#fff7d6', door: '#ff8ce6', accent: '#ffffff' }
  };
  PM.WORLD_THEMES = ['neon', 'cyber', 'ice', 'lava', 'space'];

  /* ---------- garage / shop ---------- */
  PM.CATALOG = {
    color: [
      { id: 'yellow', name: 'Classic Yellow', value: '#ffe14d', unlock: null },
      { id: 'cyan', name: 'Neon Cyan', value: '#4ef2ff', unlock: { coins: 150 } },
      { id: 'pink', name: 'Hot Pink', value: '#ff5ec8', unlock: { coins: 150 } },
      { id: 'lime', name: 'Lime Rush', value: '#9dff4e', unlock: { coins: 200 } },
      { id: 'orange', name: 'Sunset', value: '#ff9a3a', unlock: { coins: 200 } },
      { id: 'white', name: 'Ghost White', value: '#f4f4ff', unlock: { coins: 250 } },
      { id: 'shadow', name: 'Shadow', value: '#1b1b2e', unlock: { coins: 400 } },
      { id: 'gold', name: 'Solid Gold', value: 'gold', unlock: { ach: 'score100k' } },
      { id: 'rainbow', name: 'Rainbow', value: 'rainbow', unlock: { coins: 900 } }
    ],
    hat: [
      { id: 'none', name: 'No Hat', unlock: null },
      { id: 'cap', name: 'Cap', unlock: { coins: 100 } },
      { id: 'bow', name: 'Bow', unlock: { coins: 120 } },
      { id: 'party', name: 'Party Hat', unlock: { coins: 150 } },
      { id: 'headphones', name: 'Headphones', unlock: { coins: 220 } },
      { id: 'antenna', name: 'Antenna', unlock: { coins: 260 } },
      { id: 'horns', name: 'Viking', unlock: { ach: 'ghosts100' } },
      { id: 'halo', name: 'Halo', unlock: { ach: 'perfect' } },
      { id: 'crown', name: 'Crown', unlock: { ach: 'battle_win' } }
    ],
    trail: [
      { id: 'none', name: 'No Trail', unlock: null },
      { id: 'sparkle', name: 'Sparkle', unlock: { coins: 200 } },
      { id: 'hearts', name: 'Hearts', unlock: { coins: 200 } },
      { id: 'fire', name: 'Fire', unlock: { coins: 260 } },
      { id: 'pixels', name: 'Pixels', unlock: { coins: 300 } },
      { id: 'rainbow', name: 'Rainbow', unlock: { coins: 450 } }
    ],
    theme: [
      { id: 'retro', name: 'Retro', unlock: null },
      { id: 'neon', name: 'Neon City', unlock: null },
      { id: 'cyber', name: 'Cyber Jungle', unlock: { coins: 150 } },
      { id: 'ice', name: 'Ice Cavern', unlock: { coins: 150 } },
      { id: 'lava', name: 'Lava Core', unlock: { coins: 200 } },
      { id: 'space', name: 'Deep Space', unlock: { coins: 300 } },
      { id: 'gold', name: 'Golden Arcade', unlock: { ach: 'level10' } }
    ]
  };
  PM.GARAGE_TABS = [['color', 'Color'], ['hat', 'Hat'], ['trail', 'Trail'], ['theme', 'Classic maze']];

  /* ---------- AI rivals (Battle) ---------- */
  PM.BOT_SKILL = {
    easy: { name: 'Easy', depth: 7, mistake: 0.16, danger: 0.75, react: 0.45, speed: 0.92, margin: 0.5, horizon: 1.1 },
    normal: { name: 'Normal', depth: 11, mistake: 0.06, danger: 1, react: 0.25, speed: 0.97, margin: 1, horizon: 1.8 },
    hard: { name: 'Hard', depth: 15, mistake: 0.015, danger: 1.15, react: 0.1, speed: 1, margin: 1.5, horizon: 2.5 }
  };
  PM.PERSONALITIES = {
    greedy: { name: 'Greedy', dot: 1.3, hunt: 0.8, pow: 0.8, danger: 0.9, gamma: 0.8 },
    hunter: { name: 'Hunter', dot: 0.9, hunt: 1.7, pow: 1, danger: 0.9, gamma: 0.83 },
    cautious: { name: 'Cautious', dot: 1, hunt: 0.7, pow: 1, danger: 1.5, gamma: 0.84 },
    trickster: { name: 'Trickster', dot: 0.9, hunt: 1.1, pow: 2.2, danger: 1, gamma: 0.82 }
  };
  PM.BOTS = [
    { name: 'ZIPPY', color: '#4ef2ff', hat: 'cap' },
    { name: 'MOCHI', color: '#ff5ec8', hat: 'bow' },
    { name: 'BOLT', color: '#9dff4e', hat: 'antenna' },
    { name: 'NOVA', color: '#ff9a3a', hat: 'headphones' },
    { name: 'PIXEL', color: '#f4f4ff', hat: 'party' },
    { name: 'KIWI', color: '#b58cff', hat: 'horns' }
  ];
  PM.BOT_LINES = {
    powered: ['😈', '💪', '😎'], scared: ['😱', '😬', '🏃'], ate: ['😋', '🔥', '✌️'], died: ['😵', '😭', '😤'], win: ['🏆']
  };

  /* ---------- progression ---------- */
  PM.ACHIEVEMENTS = [
    { id: 'first', icon: '🪙', name: 'Insert Coin', desc: 'Finish your first game.' },
    { id: 'level5', icon: '🗺️', name: 'Maze Runner', desc: 'Reach level 5.' },
    { id: 'level10', icon: '🏃', name: 'Marathon', desc: 'Reach level 10.' },
    { id: 'ghost4', icon: '👻', name: 'Ghost Buster', desc: 'Eat all 4 ghosts with one energizer.' },
    { id: 'ghosts100', icon: '🪦', name: 'Spirit Collector', desc: 'Eat 100 ghosts in total.' },
    { id: 'fruit10', icon: '🍒', name: 'Fruit Salad', desc: 'Eat 10 bonus fruits in total.' },
    { id: 'score50k', icon: '🏅', name: '50K Club', desc: 'Score 50,000 in one game.' },
    { id: 'score100k', icon: '💯', name: 'Six Digits', desc: 'Score 100,000 in one game.' },
    { id: 'perfect', icon: '😇', name: 'Untouchable', desc: 'Clear a level without losing a life.' },
    { id: 'battle_win', icon: '⚔️', name: 'Arena Champ', desc: 'Win a Battle.' },
    { id: 'battle_hard', icon: '🦾', name: 'Bot Crusher', desc: 'Win a Battle against 3 Hard rivals.' },
    { id: 'combo50', icon: '🔥', name: 'Combo Master', desc: 'Reach a 50-dot combo.' },
    { id: 'power20', icon: '⚡', name: 'Power User', desc: 'Use 20 power-ups in total.' },
    { id: 'shock3', icon: '💥', name: 'Shockwave!', desc: 'Turn 3 ghosts blue with one Shockwave.' },
    { id: 'insane', icon: '🧠', name: 'Insane Mode', desc: 'Clear a level on Insane.' },
    { id: 'daily3', icon: '📅', name: 'Daily Grinder', desc: 'Play the Daily Run 3 days in a row.' }
  ];
  PM.MISSIONS = [
    { id: 'ghosts', text: 'Eat {n} ghosts', n: [8, 12, 16], reward: 80 },
    { id: 'fruits', text: 'Eat {n} bonus fruits', n: [2, 3, 4], reward: 70 },
    { id: 'levels', text: 'Clear {n} levels', n: [2, 3, 4], reward: 90 },
    { id: 'score', text: 'Score {n} in one game', n: [20000, 30000, 45000], reward: 100 },
    { id: 'powerups', text: 'Use {n} power-ups', n: [5, 8, 12], reward: 70 },
    { id: 'battle', text: 'Win {n} Battle', n: [1], reward: 120 },
    { id: 'dots', text: 'Eat {n} dots', n: [600, 900, 1300], reward: 60 },
    { id: 'combo', text: 'Reach a {n}-dot combo', n: [25, 35], reward: 80 }
  ];
  // CPU legends on the local high score tables (clearly marked as CPU)
  PM.CPU_SCORES = {
    classic: [['ACE', 88000], ['NEO', 64000], ['VEX', 41000], ['KAI', 26000], ['LUX', 15000], ['ZED', 8000]],
    x27: [['ORB', 120000], ['SYN', 82000], ['HEX', 56000], ['ION', 33000], ['RAY', 18000], ['JET', 9000]],
    battle: [['ZIP', 42000], ['MOX', 30000], ['BIT', 21000], ['FOX', 14000], ['TAO', 9000], ['EMU', 5000]],
    daily: [['SUN', 60000], ['DAY', 40000], ['AMP', 26000], ['ELK', 15000], ['OWL', 9000], ['BEE', 4000]]
  };
})(window.PM = window.PM || {});
