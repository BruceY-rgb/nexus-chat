/**
 * Generate third-party avatar URL
 * Use DiceBear API (https://api.dicebear.com/) to generate high-quality default avatars
 * No file deployment needed, entirely URL-based
 */

/**
 * Available avatar styles
 */
export type AvatarStyle =
  | 'identicon'     // Geometric shapes style (default)
  | 'avataaars'    // Cute cartoon style
  | 'botttsNeutral' // Robot style
  | 'micah'         // Flat person style
  | 'lorelei'       // Feminine person style
  | 'shapes'       // Abstract geometric shapes
  | 'thumbs'       // Thumbs up gesture style
  | 'pixel-art'   // Pixel art style
  | 'fun-emoji'   // Fun emoji style
  | 'big-ears'    // Big ears style
  | 'big-smile'   // Big smile style
  | 'croodles'    // Doodle style
  | 'miniavs'     // Mini avatar style
  | 'adventurer'  // Adventurer style
  | 'adventurer-neutral' // Neutral adventurer style
  | 'avataaars-neutral'  // Neutral cartoon style
  | 'bottts'      // Robot style (colorful)
  | 'croodles-neutral'  // Neutral doodle style
  | 'lucide'      // Lucide icon style
  | 'micah-neutral'     // Neutral flat person style
  | 'notionists'  // Notion style
  | 'notionists-neutral' // Neutral Notion style
  | 'open-peeps'  // Open people style
  | 'personas'    // Person style
  | 'pixel-art-neutral'; // Neutral pixel art style

/**
 * Generate avatar URL
 * @param seed - Seed for generating avatar (usually user ID, email or username)
 * @param size - Avatar size in pixels, default 40px
 * @param style - Avatar style, default 'identicon'
 * @returns URL of the avatar image
 */
export function generateAvatarUrl(
  seed: string,
  size: number = 40,
  style: AvatarStyle = 'identicon'
): string {
  // Ensure seed is not empty
  if (!seed || seed.trim() === '') {
    seed = 'default-user';
  }

  // Build DiceBear API URL
  const baseUrl = 'https://api.dicebear.com/7.x';
  const params = new URLSearchParams({
    seed: seed.trim(),
    size: size.toString(),
    backgroundType: 'gradientLinear',
    // Optional: Add more custom parameters
    // radius: '10',
  });

  return `${baseUrl}/${style}/png?${params.toString()}`;
}

/**
 * Generate avatar URL based on user information
 * @param user - User object containing id, displayName or email
 * @param size - Avatar size, default 40px
 * @param style - Avatar style, default 'identicon'
 * @returns URL of the avatar image
 */
export function generateUserAvatarUrl(
  user: { id: string; displayName?: string | null; email?: string },
  size: number = 40,
  style: AvatarStyle = 'identicon'
): string {
  // Priority: displayName > email > id
  const seed = user.displayName || user.email || user.id;
  return generateAvatarUrl(seed, size, style);
}

/**
 * Get avatar URL (use custom avatar if user has one, otherwise generate default)
 * @param avatarUrl - User's custom avatar URL (may be null or undefined)
 * @param user - User object
 * @param size - Avatar size, default 40px
 * @param style - Avatar style, default 'identicon'
 * @returns Final avatar URL to use
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
  user: { id: string; displayName?: string | null; email?: string },
  size: number = 40,
  style: AvatarStyle = 'identicon'
): string {
  // If custom avatar exists and is not empty, use custom avatar
  if (avatarUrl && avatarUrl.trim() !== '') {
    return avatarUrl;
  }

  // Otherwise generate default avatar
  return generateUserAvatarUrl(user, size, style);
}

/**
 * Predefined common size constants
 */
export const AvatarSizes = {
  XSMALL: 16,
  SMALL: 24,
  MEDIUM: 32,
  LARGE: 40,
  XLARGE: 64,
  XXLARGE: 96,
  XXXLARGE: 128,
} as const;

/**
 * Predefined avatar style constants
 */
export const AvatarStyles = {
  IDENTICON: 'identicon' as AvatarStyle,
  AVATAAARS: 'avataaars' as AvatarStyle,
  BOTTT: 'botttsNeutral' as AvatarStyle,
  MICAH: 'micah' as AvatarStyle,
  LORELEI: 'lorelei' as AvatarStyle,
  SHAPES: 'shapes' as AvatarStyle,
  THUMBS: 'thumbs' as AvatarStyle,
  PIXEL_ART: 'pixel-art' as AvatarStyle,
  FUN_EMOJI: 'fun-emoji' as AvatarStyle,
  BIG_EARS: 'big-ears' as AvatarStyle,
  BIG_SMILE: 'big-smile' as AvatarStyle,
  CROODLES: 'croodles' as AvatarStyle,
  MINIAVS: 'miniavs' as AvatarStyle,
  ADVENTURER: 'adventurer' as AvatarStyle,
  ADVENTURER_NEUTRAL: 'adventurer-neutral' as AvatarStyle,
  AVATAAARS_NEUTRAL: 'avataaars-neutral' as AvatarStyle,
  BOTTT_COLORFUL: 'bottts' as AvatarStyle,
  CROODLES_NEUTRAL: 'croodles-neutral' as AvatarStyle,
  LUCIDE: 'lucide' as AvatarStyle,
  MICAH_NEUTRAL: 'micah-neutral' as AvatarStyle,
  NOTIONISTS: 'notionists' as AvatarStyle,
  NOTIONISTS_NEUTRAL: 'notionists-neutral' as AvatarStyle,
  OPEN_PEEPS: 'open-peeps' as AvatarStyle,
  PERSONAS: 'personas' as AvatarStyle,
  PIXEL_ART_NEUTRAL: 'pixel-art-neutral' as AvatarStyle,
} as const;
