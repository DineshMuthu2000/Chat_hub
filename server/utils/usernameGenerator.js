const ADJECTIVES = [
  'Blue', 'Red', 'Neon', 'Swift', 'Silent', 'Gold', 'Silver', 'Cosmic',
  'Cyber', 'Shadow', 'Crystal', 'Solar', 'Lunar', 'Velvet', 'Electric',
  'Wild', 'Brave', 'Clever', 'Mystic', 'Frost', 'Amber', 'Emerald', 'Ruby',
  'Vivid', 'Hyper', 'Zen', 'Astro', 'Quantum', 'Pixel', 'Sonic'
];

const NOUNS = [
  'Tiger', 'Falcon', 'Panda', 'Owl', 'Dragon', 'Phoenix', 'Wolf', 'Eagle',
  'Panther', 'Fox', 'Hawk', 'Dolphin', 'Viper', 'Lynx', 'Raven', 'Bear',
  'Jaguar', 'Cheetah', 'Falcon', 'Otter', 'Cobra', 'Griffin', 'Kitsune',
  'Starlight', 'Comet', 'Titan', 'Vortex', 'Spark', 'Nebula', 'Echo'
];

function generateRandomUsername() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj}${noun}${num}`;
}

module.exports = { generateRandomUsername };
