import { Injectable, Logger } from '@nestjs/common';

/**
 * 分词服务
 * 负责对搜索关键词进行分词处理
 *
 * 设计说明：
 * - 当前使用简单的 n-gram 分词实现
 * - 未来可以集成 nodejieba 或其他成熟分词库
 * - 通过抽象接口，可以方便地切换分词实现
 */
@Injectable()
export class TokenizerService {
  private readonly logger = new Logger(TokenizerService.name);

  // 常用停用词（可扩展）
  private readonly STOPWORDS = new Set([
    '的',
    '了',
    '是',
    '在',
    '和',
    '有',
    '也',
    '不',
    '就',
    '都',
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
  ]);

  /**
   * 对关键词进行分词处理
   * @param keyword 原始关键词
   * @returns 分词结果（去重后）
   */
  tokenize(keyword: string): string[] {
    if (!keyword) {
      return [];
    }

    const normalized = keyword.toLowerCase().trim();
    const tokens: string[] = [];

    // 1. 保留完整关键词
    tokens.push(normalized);

    // 2. 按空格分词（处理英文和用空格分隔的词）
    const spaceTokens = normalized
      .split(/\s+/)
      .filter((t) => t.length > 0 && !this.STOPWORDS.has(t));
    if (spaceTokens.length > 1) {
      tokens.push(...spaceTokens);
    }

    // 3. 提取中文部分并进行 n-gram 分词
    const chineseTokens = this.tokenizeChinese(normalized);
    tokens.push(...chineseTokens);

    // 4. 提取英文单词
    const englishTokens = this.tokenizeEnglish(normalized);
    tokens.push(...englishTokens);

    // 去重并过滤停用词
    return [...new Set(tokens)].filter((t) => !this.STOPWORDS.has(t));
  }

  /**
   * 中文分词（基于 n-gram）
   * 使用 2-gram 和 3-gram 提取中文词组
   */
  private tokenizeChinese(text: string): string[] {
    const tokens: string[] = [];
    const chineseSegments = text.match(/[\u4e00-\u9fa5]+/g);

    if (!chineseSegments) {
      return tokens;
    }

    for (const segment of chineseSegments) {
      // 单字不作为独立 token（太短，匹配噪音大）
      if (segment.length === 1) {
        continue;
      }

      // 完整的中文段作为一个 token
      if (segment.length >= 2) {
        tokens.push(segment);
      }

      // 2-gram
      for (let i = 0; i < segment.length - 1; i++) {
        tokens.push(segment.slice(i, i + 2));
      }

      // 3-gram（仅当段落足够长时）
      if (segment.length >= 3) {
        for (let i = 0; i < segment.length - 2; i++) {
          tokens.push(segment.slice(i, i + 3));
        }
      }
    }

    return tokens;
  }

  /**
   * 英文分词
   * 提取完整的英文单词
   */
  private tokenizeEnglish(text: string): string[] {
    const tokens: string[] = [];
    const englishWords = text.match(/[a-zA-Z]+/g);

    if (!englishWords) {
      return tokens;
    }

    for (const word of englishWords) {
      // 至少2个字符的单词才有意义
      if (word.length >= 2 && !this.STOPWORDS.has(word)) {
        tokens.push(word);
      }
    }

    return tokens;
  }

  /**
   * 计算两个词的编辑距离（用于模糊匹配）
   * 未来可用于拼写纠错
   */
  editDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;

    // 创建 DP 表
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    // 初始化
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // 填充 DP 表
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * 判断两个词是否相似（编辑距离小于阈值）
   */
  isSimilar(s1: string, s2: string, threshold: number = 2): boolean {
    // 长度差太大直接返回 false
    if (Math.abs(s1.length - s2.length) > threshold) {
      return false;
    }
    return this.editDistance(s1, s2) <= threshold;
  }
}
