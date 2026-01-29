/**
 * 生成第三方头像 URL
 * 使用 DiceBear API (https://api.dicebear.com/) 生成高质量的默认头像
 * 无需部署文件，完全基于 URL
 */

/**
 * 可用的头像风格
 */
export type AvatarStyle =
  | 'identicon'     // 几何图形风格（默认）
  | 'avataaars'    // 可爱卡通风格
  | 'botttsNeutral' // 机器人风格
  | 'micah'         // 扁平化人物风格
  | 'lorelei'       // 女性化人物风格
  | 'shapes'       // 抽象几何形状
  | 'thumbs'       // 点赞手势风格
  | 'pixel-art'   // 像素艺术风格
  | 'fun-emoji'   // 趣味表情符号
  | 'big-ears'    // 大耳朵风格
  | 'big-smile'   // 大笑脸风格
  | 'croodles'    // 涂鸦风格
  | 'miniavs'     // 迷你头像
  | 'adventurer'  // 冒险者风格
  | 'adventurer-neutral' // 中性冒险者风格
  | 'avataaars-neutral'  // 中性卡通风格
  | 'bottts'      // 机器人风格（彩色）
  | 'croodles-neutral'  // 中性涂鸦风格
  | 'lucide'      // Lucide 图标风格
  | 'micah-neutral'     // 中性扁平化人物风格
  | 'notionists'  // Notion 风格
  | 'notionists-neutral' // 中性 Notion 风格
  | 'open-peeps'  // 开放人物风格
  | 'personas'    // 人物风格
  | 'pixel-art-neutral'; // 中性像素艺术风格

/**
 * 生成头像 URL
 * @param seed - 用于生成头像的种子（通常使用用户 ID、邮箱或用户名）
 * @param size - 头像尺寸（像素），默认 40px
 * @param style - 头像风格，默认 'identicon'
 * @returns 头像图片的 URL
 */
export function generateAvatarUrl(
  seed: string,
  size: number = 40,
  style: AvatarStyle = 'identicon'
): string {
  // 确保种子不为空
  if (!seed || seed.trim() === '') {
    seed = 'default-user';
  }

  // 构建 DiceBear API URL
  const baseUrl = 'https://api.dicebear.com/7.x';
  const params = new URLSearchParams({
    seed: seed.trim(),
    size: size.toString(),
    backgroundType: 'gradientLinear',
    // 可选：添加更多自定义参数
    // radius: '10',
  });

  return `${baseUrl}/${style}/png?${params.toString()}`;
}

/**
 * 根据用户信息生成头像 URL
 * @param user - 用户对象，包含 id、displayName 或 email
 * @param size - 头像尺寸，默认 40px
 * @param style - 头像风格，默认 'identicon'
 * @returns 头像图片的 URL
 */
export function generateUserAvatarUrl(
  user: { id: string; displayName?: string | null; email?: string },
  size: number = 40,
  style: AvatarStyle = 'identicon'
): string {
  // 优先级：displayName > email > id
  const seed = user.displayName || user.email || user.id;
  return generateAvatarUrl(seed, size, style);
}

/**
 * 获取头像 URL（如果用户有自定义头像则使用，否则生成默认头像）
 * @param avatarUrl - 用户自定义头像 URL（可能为 null 或 undefined）
 * @param user - 用户对象
 * @param size - 头像尺寸，默认 40px
 * @param style - 头像风格，默认 'identicon'
 * @returns 最终使用的头像 URL
 */
export function getAvatarUrl(
  avatarUrl: string | null | undefined,
  user: { id: string; displayName?: string | null; email?: string },
  size: number = 40,
  style: AvatarStyle = 'identicon'
): string {
  // 如果有自定义头像且不为空，则使用自定义头像
  if (avatarUrl && avatarUrl.trim() !== '') {
    return avatarUrl;
  }

  // 否则生成默认头像
  return generateUserAvatarUrl(user, size, style);
}

/**
 * 预定义的常用尺寸常量
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
 * 预定义的头像风格常量
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
