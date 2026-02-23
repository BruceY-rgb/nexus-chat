/**
 * Slack emoji shortcode to Unicode mapping.
 * Covers all shortcodes found in our imported Slack data,
 * plus common extras for new messages and reactions.
 */

const emojiMap: Record<string, string> = {
  // People & Faces
  '+1': '👍',
  '-1': '👎',
  thumbsup: '👍',
  thumbsdown: '👎',
  clap: '👏',
  wave: '👋',
  raised_hands: '🙌',
  pray: '🙏',
  handshake: '🤝',
  point_right: '👉',
  point_down: '👇',
  point_up: '👆',
  point_left: '👈',
  ok_hand: '👌',
  muscle: '💪',
  writing_hand: '✍️',
  heart_hands: '🫶',
  // Faces - smiling
  grinning: '😀',
  grin: '😁',
  joy: '😂',
  rolling_on_the_floor_laughing: '🤣',
  smile: '😄',
  sweat_smile: '😅',
  laughing: '😆',
  wink: '😉',
  blush: '😊',
  innocent: '😇',
  slightly_smiling_face: '🙂',
  upside_down_face: '🙃',
  // Faces - affection
  heart_eyes: '😍',
  star_struck: '🤩',
  'star-struck': '🤩',
  kissing_heart: '😘',
  kissing: '😗',
  relaxed: '☺️',
  // Faces - tongue
  stuck_out_tongue: '😛',
  stuck_out_tongue_winking_eye: '😜',
  stuck_out_tongue_closed_eyes: '😝',
  yum: '😋',
  // Faces - hands
  hugging_face: '🤗',
  shushing_face: '🤫',
  thinking_face: '🤔',
  // Faces - neutral/skeptical
  neutral_face: '😐',
  expressionless: '😑',
  no_mouth: '😶',
  smirk: '😏',
  unamused: '😒',
  face_with_rolling_eyes: '🙄',
  grimacing: '😬',
  shrug: '🤷',
  // Faces - sleepy
  relieved: '😌',
  sleeping: '😴',
  drooling_face: '🤤',
  // Faces - unwell
  face_with_thermometer: '🤒',
  face_with_head_bandage: '🤕',
  nauseated_face: '🤢',
  sneezing_face: '🤧',
  // Faces - negative
  confused: '😕',
  worried: '😟',
  slightly_frowning_face: '🙁',
  frowning_face: '☹️',
  disappointed: '😞',
  cry: '😢',
  sob: '😭',
  angry: '😠',
  rage: '😡',
  // Faces - special
  exploding_head: '🤯',
  sunglasses: '😎',
  nerd_face: '🤓',
  melting_face: '🫠',
  face_with_spiral_eyes: '😵‍💫',
  partying_face: '🥳',
  smiling_face_with_tear: '🥲',
  'man-facepalming': '🤦‍♂️',
  facepalm: '🤦',
  smile_cat: '😸',
  // Faces - costume
  skull: '💀',
  ghost: '👻',
  robot_face: '🤖',
  space_invader: '👾',
  // People
  'female-teacher': '👩‍🏫',
  teacher: '🧑‍🏫',
  'male-technologist': '👨‍💻',
  technologist: '🧑‍💻',
  scientist: '🧑‍🔬',
  person_in_tuxedo: '🤵',
  busts_in_silhouette: '👥',
  // Hearts & emotions
  heart: '❤️',
  orange_heart: '🧡',
  yellow_heart: '💛',
  green_heart: '💚',
  blue_heart: '💙',
  purple_heart: '💜',
  black_heart: '🖤',
  white_heart: '🤍',
  broken_heart: '💔',
  sparkling_heart: '💖',
  fire: '🔥',
  boom: '💥',
  sparkles: '✨',
  star: '⭐',
  star2: '🌟',
  zap: '⚡',
  // Nature & animals
  bird: '🐦',
  owl: '🦉',
  feather: '🪶',
  snowman_without_snow: '⛄',
  cyclone: '🌀',
  ringed_planet: '🪐',
  earth_africa: '🌍',
  earth_americas: '🌎',
  earth_asia: '🌏',
  globe_with_meridians: '🌐',
  // Food & drink
  green_apple: '🍏',
  spaghetti: '🍝',
  beers: '🍻',
  // Objects - office/learning
  book: '📖',
  books: '📚',
  blue_book: '📘',
  green_book: '📗',
  orange_book: '📙',
  closed_book: '📕',
  scroll: '📜',
  memo: '📝',
  page_facing_up: '📄',
  bookmark: '🔖',
  bookmark_tabs: '📑',
  link: '🔗',
  paperclip: '📎',
  pushpin: '📌',
  round_pushpin: '📍',
  // Objects - tools
  bulb: '💡',
  mag: '🔍',
  microscope: '🔬',
  telescope: '🔭',
  computer: '💻',
  desktop_computer: '🖥️',
  // Objects - other
  bell: '🔔',
  loudspeaker: '📢',
  email: '📧',
  shield: '🛡️',
  scales: '⚖️',
  // Symbols & signs
  warning: '⚠️',
  exclamation: '❗',
  rotating_light: '🚨',
  alarm_clock: '⏰',
  hourglass_flowing_sand: '⏳',
  information_source: 'ℹ️',
  white_check_mark: '✅',
  x: '❌',
  new: '🆕',
  arrow_right: '➡️',
  left_right_arrow: '↔️',
  repeat: '🔁',
  twisted_rightwards_arrows: '🔀',
  // Activities
  tada: '🎉',
  rocket: '🚀',
  dart: '🎯',
  trophy: '🏆',
  first_place_medal: '🥇',
  golf: '⛳',
  tennis: '🎾',
  ship: '🚢',
  // Work & career
  chart_with_upwards_trend: '📈',
  bar_chart: '📊',
  calendar: '📅',
  date: '📅',
  spiral_calendar_pad: '🗓️',
  money_with_wings: '💸',
  moneybag: '💰',
  // Medical/Science
  syringe: '💉',
  dna: '🧬',
  brain: '🧠',
  mechanical_arm: '🦾',
  hospital: '🏥',
  gear: '⚙️',
  // Misc
  thought_balloon: '💭',
  nose: '👃',
  eyes: '👀',
  large_blue_square: '🟦',
  world_map: '🗺️',
  // Flags (commonly referenced)
  gb: '🇬🇧',
  us: '🇺🇸',
  // Celebration
  celebration: '🎉',
  confetti_ball: '🎊',
  balloon: '🎈',
  // Skin tone modifiers — strip them (they combine with preceding emoji)
  'skin-tone-2': '',
  'skin-tone-3': '',
  'skin-tone-4': '',
  'skin-tone-5': '',
  'skin-tone-6': '',
  // Thread/special Slack-only shortcodes (no Unicode equivalent)
  thread: '🧵',
};

/**
 * Convert a single Slack emoji shortcode (without colons) to Unicode.
 * Returns the original `:name:` text if no mapping found.
 */
export function shortcodeToEmoji(name: string): string {
  const emoji = emojiMap[name];
  if (emoji !== undefined) return emoji;
  // Return original shortcode text for unknown names
  return `:${name}:`;
}

/**
 * Convert all :shortcode: patterns in a text string to Unicode emoji.
 * Leaves unknown shortcodes untouched.
 */
export function convertShortcodesToEmoji(text: string): string {
  if (!text) return text;
  return text.replace(/:([a-z0-9_+\-]+):/g, (match, name) => {
    const emoji = emojiMap[name];
    if (emoji !== undefined) return emoji;
    return match; // leave unknown shortcodes as-is
  });
}

/**
 * Check if text contains any :shortcode: patterns.
 */
export function hasEmojiShortcodes(text: string): boolean {
  return /:([a-z0-9_+\-]+):/.test(text);
}
