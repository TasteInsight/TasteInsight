import { createHash } from 'crypto';

/**
 * 哈希工具函数，使用Node.js内置crypto模块
 * 提供一致性哈希算法，用于实验分组、缓存key生成等场景
 */

/**
 * 简单哈希函数（基于SHA-256）
 * 用于一致性分流、用户分组等场景
 * 返回32位无符号整数
 *
 * @param str 输入字符串
 * @returns 无符号32位整数
 */
export function hashString(str: string): number {
  // 使用SHA-256的前4字节作为哈希值
  const hash = createHash('sha256').update(str).digest();
  // 取前4字节并转换为无符号32位整数
  return hash.readUInt32BE(0);
}

/**
 * 生成短哈希字符串（用于缓存key等场景）
 * 基于SHA-256，返回base64url编码的短字符串
 *
 * @param str 输入字符串
 * @returns 短哈希字符串
 */
export function hashToShortString(str: string): string {
  // 使用SHA-256的前6字节，转换为base64url
  const hash = createHash('sha256').update(str).digest();
  const shortHash = hash.subarray(0, 6);
  return shortHash.toString('base64url');
}

/**
 * 归一化哈希值到 [0, 1) 区间
 * 用于流量分配、AB测试等场景
 * 使用SHA-256确保均匀分布
 *
 * @param str 输入字符串
 * @returns 0到1之间的浮点数
 */
export function normalizedHash(str: string): number {
  const hash = hashString(str);
  // 归一化到[0, 1)
  return hash / 0x100000000;
}
