class SeededRandom {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

export const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
};

interface Gradient {
  stop1: string;
  stop2: string;
}

const PASTEL_GRADIENTS: Gradient[] = [
  { stop1: '#ff9a9e', stop2: '#fad0c4' }, // Pink -> Peach
  { stop1: '#a1c4fd', stop2: '#c2e9fb' }, // Blue -> Ice Blue
  { stop1: '#84fab0', stop2: '#8fd3f4' }, // Mint -> Cyan
  { stop1: '#f6d365', stop2: '#fda085' }, // Yellow -> Orange-peach
  { stop1: '#e0c3fc', stop2: '#8ec5fc' }, // Lavender -> Soft Blue
  { stop1: '#fbc2eb', stop2: '#a6c1ee' }  // Pink -> Lavender
];

export function generateVectorAvatarSvg(uid: string): string {
  const hash = hashString(uid);
  const rand = new SeededRandom(hash);

  // 1. Choose background pastel gradient
  const grad = PASTEL_GRADIENTS[Math.floor(rand.next() * PASTEL_GRADIENTS.length)];
  const gradientId = `avatar-grad-${hash}`;

  const backgroundLayer = `
    <defs>
      <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${grad.stop1}" />
        <stop offset="100%" stop-color="${grad.stop2}" />
      </linearGradient>
    </defs>
    <circle cx="20" cy="20" r="20" fill="url(#${gradientId})" />
  `;

  // 2. Select Archetype (0: Cat, 1: Bear, 2: Rabbit, 3: Fox, 4: Slime, 5: Anime Girl)
  const archetype = hash % 6;

  let effectsLayer = '';
  let characterLayer = '';
  let faceLayer = '';
  let eyesLayer = '';
  let mouthLayer = '';
  let accessoryLayer = '';

  // 3. Effects Layer (Bubbles or Sparkles in background)
  const effectType = Math.floor(rand.next() * 3);
  if (effectType === 0) {
    effectsLayer = `
      <path d="M8,12 L9,14 L11,14 L9,15 L10,17 L8,16 L6,17 L7,15 L5,14 L7,14 Z" fill="#fff" opacity="0.65" />
      <path d="M32,15 L32.5,16 L33.5,16 L32.7,16.7 L33,18 L32,17.3 L31,18 L31.3,16.7 L30.5,16 Z" fill="#fff" opacity="0.5" />
    `;
  } else if (effectType === 1) {
    effectsLayer = `
      <circle cx="7" cy="15" r="1.5" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.5" />
      <circle cx="33" cy="12" r="2" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.5" />
      <circle cx="31" cy="28" r="1" fill="none" stroke="#fff" stroke-width="0.6" opacity="0.4" />
    `;
  }

  // 4. Character Rendering per Archetype
  if (archetype === 0) {
    // ────────────── CAT ARCHETYPE ──────────────
    const catFurs = ['#f1f5f9', '#fdba74', '#94a3b8', '#475569', '#fef3c7'];
    const catEyes = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#334155'];
    const furColor = catFurs[Math.floor(rand.next() * catFurs.length)];
    const eyeColor = catEyes[Math.floor(rand.next() * catEyes.length)];
    const innerEar = '#fda4af';

    const wink = rand.next() > 0.5;
    const bow = rand.next() > 0.6;
    const star = rand.next() > 0.6;

    // Ears
    characterLayer += `
      <polygon points="11,15 11,5 18,14" fill="${furColor}" />
      <polygon points="12,14 12,7 16,13" fill="${innerEar}" />
      <polygon points="29,15 29,5 22,14" fill="${furColor}" />
      <polygon points="28,14 28,7 24,13" fill="${innerEar}" />
    `;

    // Shoulders
    characterLayer += `<ellipse cx="20" cy="34" rx="9" ry="6" fill="${furColor}" />`;
    // Head
    characterLayer += `<circle cx="20" cy="22" r="10" fill="${furColor}" />`;

    // Cheeks & Whiskers
    faceLayer += `
      <line x1="9" y1="22" x2="5" y2="21" stroke="#475569" stroke-width="0.8" stroke-linecap="round" />
      <line x1="9" y1="23.5" x2="5" y2="23.5" stroke="#475569" stroke-width="0.8" stroke-linecap="round" />
      <line x1="31" y1="22" x2="35" y2="21" stroke="#475569" stroke-width="0.8" stroke-linecap="round" />
      <line x1="31" y1="23.5" x2="35" y2="23.5" stroke="#475569" stroke-width="0.8" stroke-linecap="round" />
      <circle cx="13" cy="24" r="1.5" fill="#f43f5e" opacity="0.4" />
      <circle cx="27" cy="24" r="1.5" fill="#f43f5e" opacity="0.4" />
    `;

    // Eyes
    const rightEyeSvg = wink 
      ? `<path d="M23,22 Q25,20.5 27,22" stroke="${eyeColor}" stroke-width="2" stroke-linecap="round" fill="none" />`
      : `<circle cx="25" cy="22" r="1.8" fill="${eyeColor}" /><circle cx="24.5" cy="21.3" r="0.6" fill="#fff" />`;

    eyesLayer += `
      <circle cx="15" cy="22" r="1.8" fill="${eyeColor}" />
      <circle cx="14.5" cy="21.3" r="0.6" fill="#fff" />
      ${rightEyeSvg}
    `;

    // Mouth / Nose
    mouthLayer += `
      <polygon points="19.5,23.2 20.5,23.2 20,23.8" fill="#fda4af" />
      <path d="M18.5,24.8 Q19.2,25.8 20,24.8 Q20.8,25.8 21.5,24.8" stroke="#334155" stroke-width="1" stroke-linecap="round" fill="none" />
    `;

    // Accessories
    if (bow) {
      accessoryLayer += `
        <path d="M17,31.5 Q20,32.5 23,31.5 L22,29.5 Q20,30.5 18,29.5 Z" fill="#ef4444" />
        <circle cx="20" cy="30.5" r="1.2" fill="#facc15" />
      `;
    }
    if (star) {
      accessoryLayer += `
        <path d="M28,15 L29,17 L31,17 L29.5,18 L30,20 L28,19 L26,20 L26.5,18 L25,17 L27,17 Z" fill="#fbbf24" stroke="#d97706" stroke-width="0.5" />
      `;
    }

  } else if (archetype === 1) {
    // ────────────── BEAR ARCHETYPE ──────────────
    const bearFurs = ['#b45309', '#f8fafc', '#f59e0b', '#1e293b']; // Brown, Polar, Honey, Panda (Custom Black)
    const furType = Math.floor(rand.next() * bearFurs.length);
    const furColor = bearFurs[furType];
    const snoutColor = '#fef3c7';

    const glasses = rand.next() > 0.7;
    const scarf = rand.next() > 0.7;
    const flower = rand.next() > 0.7;
    const sleeping = rand.next() > 0.75;

    const isPanda = furType === 3;
    const headColor = isPanda ? '#ffffff' : furColor;
    const earColor = isPanda ? '#1e293b' : furColor;
    const innerEar = isPanda ? '#1e293b' : '#fca5a5';

    // Ears
    characterLayer += `
      <circle cx="12" cy="14" r="3.5" fill="${earColor}" />
      <circle cx="12" cy="14" r="2" fill="${innerEar}" />
      <circle cx="28" cy="14" r="3.5" fill="${earColor}" />
      <circle cx="28" cy="14" r="2" fill="${innerEar}" />
    `;

    // Shoulders
    characterLayer += `<ellipse cx="20" cy="34" rx="9" ry="6" fill="${headColor}" />`;
    // Head
    characterLayer += `<circle cx="20" cy="22" r="10" fill="${headColor}" />`;

    // Panda patches
    if (isPanda) {
      faceLayer += `
        <ellipse cx="14.5" cy="21.5" rx="2.5" ry="3.5" fill="#1e293b" transform="rotate(-15, 14.5, 21.5)" />
        <ellipse cx="25.5" cy="21.5" rx="2.5" ry="3.5" fill="#1e293b" transform="rotate(15, 25.5, 21.5)" />
      `;
    }

    // Snout & Cheek blush
    faceLayer += `
      <ellipse cx="20" cy="24.5" rx="2.8" ry="1.8" fill="${snoutColor}" />
      <circle cx="12.5" cy="24" r="1.5" fill="#f43f5e" opacity="0.4" />
      <circle cx="27.5" cy="24" r="1.5" fill="#f43f5e" opacity="0.4" />
    `;

    // Eyes
    const eyeColor = isPanda ? '#ffffff' : '#1e293b';
    const eyeRadius = isPanda ? 1.0 : 1.6;

    if (sleeping) {
      eyesLayer += `
        <path d="M13,21.5 Q15,23 16,21.5" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" fill="none" />
        <path d="M24,21.5 Q25,23 27,21.5" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" fill="none" />
      `;
    } else {
      eyesLayer += `
        <circle cx="15" cy="21.5" r="${eyeRadius}" fill="${eyeColor}" />
        ${!isPanda ? `<circle cx="14.5" cy="20.8" r="0.5" fill="#fff" />` : ''}
        <circle cx="25" cy="21.5" r="${eyeRadius}" fill="${eyeColor}" />
        ${!isPanda ? `<circle cx="24.5" cy="20.8" r="0.5" fill="#fff" />` : ''}
      `;
    }

    // Nose & Mouth
    mouthLayer += `
      <polygon points="19.2,23.8 20.8,23.8 20,24.4" fill="#1e293b" />
      <path d="M19,25.2 Q20,25.9 21,25.2" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round" fill="none" />
    `;

    // Bear Accessories
    if (glasses && !sleeping) {
      accessoryLayer += `
        <circle cx="15" cy="21.5" r="3.2" stroke="#ef4444" stroke-width="1.2" fill="none" />
        <circle cx="25" cy="21.5" r="3.2" stroke="#ef4444" stroke-width="1.2" fill="none" />
        <line x1="18.2" y1="21.5" x2="21.8" y2="21.5" stroke="#ef4444" stroke-width="1.2" />
      `;
    }
    if (scarf) {
      accessoryLayer += `
        <path d="M11.5,30 C15,33 25,33 28.5,30 C30,33 29,36 26,36 L14,36 Z" fill="#3b82f6" />
        <path d="M25,32 L27,37 L29,36 L27,31 Z" fill="#2563eb" />
      `;
    }
    if (flower) {
      accessoryLayer += `
        <circle cx="27" cy="14" r="1.2" fill="#fbbf24" />
        <circle cx="25.8" cy="14" r="1" fill="#fff" />
        <circle cx="28.2" cy="14" r="1" fill="#fff" />
        <circle cx="27" cy="12.8" r="1" fill="#fff" />
        <circle cx="27" cy="15.2" r="1" fill="#fff" />
      `;
    }

  } else if (archetype === 2) {
    // ────────────── RABBIT ARCHETYPE ──────────────
    const bunnyFurs = ['#ffffff', '#fee2e2', '#f5f5f4', '#fef3c7'];
    const furColor = bunnyFurs[Math.floor(rand.next() * bunnyFurs.length)];
    const innerEar = '#fda4af';

    const floppy = rand.next() > 0.5;
    const carrot = rand.next() > 0.6;
    const ribbon = rand.next() > 0.6;

    // Ears
    if (floppy) {
      characterLayer += `
        <path d="M11,14 Q8,1 5,8 Q3,15 9,14 Z" fill="${furColor}" />
        <path d="M10,13 Q8,3 6,8 Q5,13 9,12 Z" fill="${innerEar}" />
        <path d="M29,14 Q32,1 35,8 Q37,15 31,14 Z" fill="${furColor}" />
        <path d="M30,13 Q32,3 34,8 Q35,13 31,12 Z" fill="${innerEar}" />
      `;
    } else {
      characterLayer += `
        <rect x="11" y="4" width="4.5" height="12" rx="2.2" fill="${furColor}" />
        <rect x="12.2" y="6" width="2" height="9" rx="1" fill="${innerEar}" />
        <rect x="24.5" y="4" width="4.5" height="12" rx="2.2" fill="${furColor}" />
        <rect x="25.8" y="6" width="2" height="9" rx="1" fill="${innerEar}" />
      `;
    }

    // Shoulders
    characterLayer += `<ellipse cx="20" cy="34" rx="9" ry="6" fill="${furColor}" />`;
    // Head
    characterLayer += `<circle cx="20" cy="22" r="9.5" fill="${furColor}" />`;

    // Cheeks
    faceLayer += `
      <circle cx="12.5" cy="24" r="1.5" fill="#f43f5e" opacity="0.4" />
      <circle cx="27.5" cy="24" r="1.5" fill="#f43f5e" opacity="0.4" />
    `;

    // Eyes
    eyesLayer += `
      <circle cx="15" cy="22" r="1.5" fill="#334155" />
      <circle cx="14.5" cy="21.3" r="0.5" fill="#fff" />
      <circle cx="25" cy="22" r="1.5" fill="#334155" />
      <circle cx="24.5" cy="21.3" r="0.5" fill="#fff" />
    `;

    //Buck teeth & Nose
    mouthLayer += `
      <circle cx="20" cy="23.5" r="0.8" fill="#fda4af" />
      <path d="M19,24.5 L19,25.5 L20,25.5 L20,24.5 L21,24.5 L21,25.5 L22,25.5 Z" fill="#fff" stroke="#334155" stroke-width="0.6" stroke-linejoin="round" />
    `;

    // Accessories
    if (carrot) {
      accessoryLayer += `
        <polygon points="25,27 30,33 27,34" fill="#f97316" stroke="#ea580c" stroke-width="0.4" />
        <path d="M25,27 Q24,25 22,26" stroke="#22c55e" stroke-width="1.2" stroke-linecap="round" fill="none" />
      `;
    }
    if (ribbon) {
      accessoryLayer += `
        <circle cx="13" cy="14" r="1.5" fill="#ec4899" />
        <polygon points="13,14 10,12 10,16 Z" fill="#f472b6" />
        <polygon points="13,14 16,12 16,16 Z" fill="#f472b6" />
      `;
    }

  } else if (archetype === 3) {
    // ────────────── FOX ARCHETYPE ──────────────
    const foxFurs = ['#f97316', '#ea580c'];
    const furColor = foxFurs[Math.floor(rand.next() * foxFurs.length)];
    
    const showTail = rand.next() > 0.35;
    const earSize = rand.next() > 0.5 ? 'large' : 'medium';
    const flower = rand.next() > 0.6;

    // Tail (first behind character)
    if (showTail) {
      characterLayer += `
        <path d="M26,24 C32,22 38,26 36,32 C34,35 30,32 28,28 Z" fill="${furColor}" />
        <path d="M36,32 C34,35 31,34 32,32 Z" fill="#ffffff" />
      `;
    }

    // Ears
    const earH = earSize === 'large' ? 4 : 7;
    characterLayer += `
      <polygon points="8,16 10,${earH} 19,16" fill="${furColor}" />
      <polygon points="11,14 12,${earH + 2} 17,14" fill="#fca5a5" />
      <polygon points="10,${earH} 9,${earH + 3} 12,${earH + 3} Z" fill="#ffffff" />
      
      <polygon points="31,16 30,${earH} 21,16" fill="${furColor}" />
      <polygon points="29,14 28,${earH + 2} 23,14" fill="#fca5a5" />
      <polygon points="30,${earH} 28,${earH + 3} 31,${earH + 3} Z" fill="#ffffff" />
    `;

    // Shoulders
    characterLayer += `
      <ellipse cx="20" cy="34" rx="9" ry="6" fill="${furColor}" />
      <ellipse cx="20" cy="34" rx="4" ry="5" fill="#ffffff" />
    `;

    // Head base & white cheek highlights
    characterLayer += `
      <circle cx="20" cy="22" r="9.5" fill="${furColor}" />
      <path d="M10.5,22 C10,24.5 12,27 16,28 C13,26 12.5,23.5 13,22 Z" fill="#ffffff" />
      <path d="M29.5,22 C30,24.5 28,27 24,28 C27,26 27.5,23.5 27,22 Z" fill="#ffffff" />
    `;

    // Cheeks
    faceLayer += `
      <circle cx="13" cy="24" r="1" fill="#f43f5e" opacity="0.4" />
      <circle cx="27" cy="24" r="1" fill="#f43f5e" opacity="0.4" />
    `;

    // Eyes
    eyesLayer += `
      <path d="M13.5,21.5 Q15.5,20.2 17,21.5" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" fill="none" />
      <path d="M23,21.5 Q24.5,20.2 26.5,21.5" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" fill="none" />
    `;

    // Nose & Mouth
    mouthLayer += `
      <circle cx="20" cy="23.8" r="0.8" fill="#1e293b" />
      <path d="M19,25 Q20,26.2 21.5,25" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round" fill="none" />
    `;

    // Accessories
    if (flower) {
      accessoryLayer += `
        <circle cx="14" cy="15" r="1" fill="#facc15" />
        <circle cx="13" cy="14" r="1" fill="#fff" />
        <circle cx="15" cy="16" r="1" fill="#fff" />
        <circle cx="13" cy="16" r="1" fill="#fff" />
        <circle cx="15" cy="14" r="1" fill="#fff" />
      `;
    }

  } else if (archetype === 4) {
    // ────────────── SLIME ARCHETYPE ──────────────
    const slimeColors = ['#38bdf8', '#818cf8', '#34d399', '#f472b6', '#fbbf24'];
    const bodyColor = slimeColors[Math.floor(rand.next() * slimeColors.length)];

    const crown = rand.next() > 0.6;
    const sparkles = rand.next() > 0.5;
    const expression = Math.floor(rand.next() * 3); // 0: happy, 1: angry, 2: sleepy

    // Background sparkles (Effect Layer overrides)
    if (sparkles) {
      effectsLayer += `
        <path d="M31,11 L31.8,12.5 L33.5,12.5 L32.1,13.3 L32.6,15 L31.2,14.1 L29.8,15 L30.3,13.3 L28.9,12.5 L30.6,12.5 Z" fill="#ffffff" opacity="0.8" />
        <path d="M8,26 L8.5,27 L9.5,27 L8.7,27.5 L9,28.5 L8,28 L7,28.5 L7.3,27.5 L6.5,27 L7.5,27 Z" fill="#ffffff" opacity="0.6" />
      `;
    }

    // Body Jelly Drop
    characterLayer += `
      <path d="M20,11 C26.5,11 31.5,18 31.5,25.5 C31.5,32 26.5,32.5 20,32.5 C13.5,32.5 8.5,32 8.5,25.5 C8.5,18 13.5,11 20,11 Z" fill="${bodyColor}" />
      <path d="M15,15 C13,18 12,22 13.5,26" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.4" />
    `;

    // Cheeks
    faceLayer += `
      <circle cx="13" cy="25" r="1.5" fill="#ff8fa3" opacity="0.6" />
      <circle cx="27" cy="25" r="1.5" fill="#ff8fa3" opacity="0.6" />
    `;

    // Expression
    if (expression === 0) {
      // Happy
      eyesLayer += `
        <path d="M13,22 Q15,20.5 17,22" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M23,22 Q25,20.5 27,22" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" fill="none" />
      `;
      mouthLayer += `<path d="M18.5,25 Q20,27 21.5,25" stroke="#1e293b" stroke-width="1.2" stroke-linecap="round" fill="none" />`;
    } else if (expression === 1) {
      // Angry
      eyesLayer += `
        <path d="M13,20.5 L16.5,22.5 L13,24.5" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" fill="none" />
        <path d="M27,20.5 L23.5,22.5 L27,24.5" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" fill="none" />
      `;
      mouthLayer += `<path d="M18.5,27 Q20,25.5 21.5,27" stroke="#1e293b" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.8" />`;
    } else {
      // Sleepy
      eyesLayer += `
        <line x1="13.5" y1="22.5" x2="16.5" y2="22.5" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" />
        <line x1="23.5" y1="22.5" x2="26.5" y2="22.5" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" />
      `;
      mouthLayer += `<circle cx="20" cy="25.5" r="1.2" fill="#1e293b" />`;
    }

    // Slime Accessories
    if (crown) {
      accessoryLayer += `
        <polygon points="17,11.5 16,7.5 18.5,9.5 20,6.5 21.5,9.5 24,7.5 23,11.5 Z" fill="#fbbf24" stroke="#d97706" stroke-width="0.6" stroke-linejoin="round" />
        <circle cx="16" cy="7.5" r="0.5" fill="#d97706" />
        <circle cx="20" cy="6.5" r="0.5" fill="#d97706" />
        <circle cx="24" cy="7.5" r="0.5" fill="#d97706" />
      `;
    }

  } else {
    // ────────────── ANIME GIRL ARCHETYPE ──────────────
    const girlHairs = ['#f472b6', '#818cf8', '#60a5fa', '#34d399', '#a78bfa', '#f59e0b', '#374151'];
    const girlEyes = ['#818cf8', '#f472b6', '#34d399', '#f59e0b', '#1e293b'];
    const hairColor = girlHairs[Math.floor(rand.next() * girlHairs.length)];
    const eyeColor = girlEyes[Math.floor(rand.next() * girlEyes.length)];
    const skinColor = '#ffecd5';

    const wink = rand.next() > 0.5;
    const clip = rand.next() > 0.5;
    const glasses = rand.next() > 0.85;
    const doubleClips = rand.next() > 0.5;

    // Back Hair
    characterLayer += `<rect x="9.5" y="19" width="21" height="15" rx="4.5" fill="${hairColor}" />`;

    // Shoulders
    characterLayer += `
      <ellipse cx="20" cy="34" rx="8" ry="5.5" fill="#f43f5e" />
      <ellipse cx="20" cy="34" rx="4" ry="4" fill="#ffffff" />
      <polygon points="17,29 23,29 20,32 Z" fill="${skinColor}" />
    `;

    // Head base
    characterLayer += `<circle cx="20" cy="22" r="8.5" fill="${skinColor}" />`;

    // Bangs and hair locks
    characterLayer += `
      <path d="M10,18.5 L9.5,27 L11.5,27 Z" fill="${hairColor}" />
      <path d="M30,18.5 L30.5,27 L28.5,27 Z" fill="${hairColor}" />
      <path d="M9.5,19 Q15,14 20,18 Q25,14 30.5,19 L30.5,21.5 Q20,20 9.5,21.5 Z" fill="${hairColor}" />
    `;

    // Blush
    faceLayer += `
      <circle cx="13" cy="24" r="1.2" fill="#fda4af" opacity="0.6" />
      <circle cx="27" cy="24" r="1.2" fill="#fda4af" opacity="0.6" />
    `;

    // Eyes
    const leftEye = `<ellipse cx="14.8" cy="22.2" rx="2" ry="2.8" fill="${eyeColor}" /><circle cx="14.3" cy="21.5" r="0.6" fill="#fff" /><circle cx="15.3" cy="23" r="0.3" fill="#fff" />`;

    const rightEye = wink 
      ? `<path d="M23.5,22.2 Q25.2,20.5 27,22.2" stroke="${eyeColor}" stroke-width="1.8" stroke-linecap="round" fill="none" />`
      : `<ellipse cx="25.2" cy="22.2" rx="2" ry="2.8" fill="${eyeColor}" /><circle cx="24.7" cy="21.5" r="0.6" fill="#fff" /><circle cx="25.7" cy="23" r="0.3" fill="#fff" />`;

    eyesLayer += `
      ${leftEye}
      ${rightEye}
    `;

    // Mouth
    mouthLayer += `<path d="M18.8,25.2 Q20,26.2 21.2,25.2" stroke="#475569" stroke-width="0.8" stroke-linecap="round" fill="none" />`;

    // Anime Accessories
    if (clip) {
      accessoryLayer += `
        <rect x="11.5" y="17.2" width="2.5" height="0.8" fill="#facc15" transform="rotate(-15, 11.5, 17.2)" />
        ${doubleClips ? `<rect x="11.8" y="18.2" width="2.5" height="0.8" fill="#38bdf8" transform="rotate(-15, 11.8, 18.2)" />` : ''}
      `;
    }
    if (glasses && !wink) {
      accessoryLayer += `
        <circle cx="14.8" cy="22.2" r="3.2" stroke="#ef4444" stroke-width="1" fill="none" opacity="0.9" />
        <circle cx="25.2" cy="22.2" r="3.2" stroke="#ef4444" stroke-width="1" fill="none" opacity="0.9" />
        <line x1="18" y1="22.2" x2="22" y2="22.2" stroke="#ef4444" stroke-width="1" opacity="0.9" />
      `;
    }
  }

  // 5. Assemble and wrap SVG in 40x40 viewport
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="100%" height="100%">
    ${backgroundLayer}
    ${effectsLayer}
    ${characterLayer}
    ${faceLayer}
    ${eyesLayer}
    ${mouthLayer}
    ${accessoryLayer}
  </svg>`;

  return svg;
}

const avatarCache = new Map<string, string>();

export function getVectorAvatarUri(uid: string): string {
  if (!uid) return '';
  const cached = avatarCache.get(uid);
  if (cached) return cached;

  const svg = generateVectorAvatarSvg(uid);
  const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  avatarCache.set(uid, uri);
  return uri;
}
