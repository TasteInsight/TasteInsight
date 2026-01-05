import { Test, TestingModule } from '@nestjs/testing';
import { TokenizerService } from './tokenizer.service';

describe('TokenizerService', () => {
  let service: TokenizerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenizerService],
    }).compile();

    service = module.get<TokenizerService>(TokenizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('tokenize', () => {
    it('should return empty array for empty input', () => {
      expect(service.tokenize('')).toEqual([]);
      expect(service.tokenize(null as any)).toEqual([]);
    });

    it('should tokenize simple Chinese text', () => {
      const result = service.tokenize('宫保鸡丁');

      expect(result).toContain('宫保鸡丁');
      // 2-gram tokens
      expect(result).toContain('宫保');
      expect(result).toContain('保鸡');
      expect(result).toContain('鸡丁');
    });

    it('should tokenize English text', () => {
      const result = service.tokenize('kung pao chicken');

      expect(result).toContain('kung pao chicken');
      expect(result).toContain('kung');
      expect(result).toContain('pao');
      expect(result).toContain('chicken');
    });

    it('should handle mixed Chinese and English', () => {
      const result = service.tokenize('麻婆豆腐 mapo tofu');

      expect(result).toContain('麻婆豆腐 mapo tofu');
      expect(result).toContain('麻婆豆腐');
      expect(result).toContain('mapo');
      expect(result).toContain('tofu');
    });

    it('should filter stopwords', () => {
      const result = service.tokenize('好吃的红烧肉');

      // "的" 是停用词，应该被过滤
      expect(result).not.toContain('的');
      expect(result).toContain('红烧肉');
    });

    it('should normalize to lowercase', () => {
      const result = service.tokenize('KUNG PAO');

      expect(result).toContain('kung pao');
      expect(result).toContain('kung');
      expect(result).toContain('pao');
    });

    it('should handle single Chinese character', () => {
      const result = service.tokenize('菜');

      // 单字被包含在完整关键词中
      expect(result).toContain('菜');
    });

    it('should generate 3-gram tokens for longer text', () => {
      const result = service.tokenize('红烧肉丸');

      // 3-gram tokens
      expect(result).toContain('红烧肉');
      expect(result).toContain('烧肉丸');
    });

    it('should deduplicate tokens', () => {
      const result = service.tokenize('鸡鸡');

      // 去重后应该只有一个
      const unique = [...new Set(result)];
      expect(result).toEqual(unique);
    });
  });

  describe('editDistance', () => {
    it('should return 0 for identical strings', () => {
      expect(service.editDistance('test', 'test')).toBe(0);
      expect(service.editDistance('宫保鸡丁', '宫保鸡丁')).toBe(0);
    });

    it('should return string length for empty comparison', () => {
      expect(service.editDistance('test', '')).toBe(4);
      expect(service.editDistance('', 'test')).toBe(4);
    });

    it('should calculate correct distance for single character difference', () => {
      expect(service.editDistance('test', 'text')).toBe(1);
      expect(service.editDistance('cat', 'bat')).toBe(1);
    });

    it('should calculate correct distance for insertions', () => {
      expect(service.editDistance('test', 'tests')).toBe(1);
      expect(service.editDistance('ab', 'abc')).toBe(1);
    });

    it('should calculate correct distance for deletions', () => {
      expect(service.editDistance('tests', 'test')).toBe(1);
      expect(service.editDistance('abc', 'ab')).toBe(1);
    });

    it('should handle complex differences', () => {
      expect(service.editDistance('sitting', 'kitten')).toBe(3);
      expect(service.editDistance('sunday', 'saturday')).toBe(3);
    });
  });

  describe('isSimilar', () => {
    it('should return true for identical strings', () => {
      expect(service.isSimilar('test', 'test')).toBe(true);
    });

    it('should return true for strings within threshold', () => {
      expect(service.isSimilar('test', 'text', 1)).toBe(true);
      expect(service.isSimilar('cat', 'bat', 1)).toBe(true);
    });

    it('should return false for strings exceeding threshold', () => {
      expect(service.isSimilar('test', 'best', 0)).toBe(false);
      expect(service.isSimilar('abc', 'xyz', 2)).toBe(false);
    });

    it('should return false if length difference exceeds threshold', () => {
      expect(service.isSimilar('a', 'abcd', 2)).toBe(false);
      expect(service.isSimilar('test', 'testing123', 2)).toBe(false);
    });

    it('should use default threshold of 2', () => {
      expect(service.isSimilar('test', 'tests')).toBe(true); // distance 1
      expect(service.isSimilar('test', 'text')).toBe(true); // distance 1
      // cat -> dog has distance 3, so it should be false with threshold 2
      expect(service.isSimilar('cat', 'dog')).toBe(false);
    });
  });
});
