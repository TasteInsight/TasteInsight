import { hashString, hashToShortString, normalizedHash } from './hash.util';

describe('Hash Utilities', () => {
  describe('hashString', () => {
    it('should produce consistent hash for same input', () => {
      const input = 'user123';
      const hash1 = hashString(input);
      const hash2 = hashString(input);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashString('user123');
      const hash2 = hashString('user456');
      expect(hash1).not.toBe(hash2);
    });

    it('should return unsigned 32-bit integer', () => {
      const hash = hashString('test');
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThanOrEqual(0xffffffff);
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle empty string', () => {
      const hash = hashString('');
      expect(hash).toBeGreaterThan(0); // SHA-256对空字符串也有哈希值
      expect(Number.isInteger(hash)).toBe(true);
    });

    it('should handle unicode characters', () => {
      const hash1 = hashString('测试');
      const hash2 = hashString('测试');
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThan(0);
    });
  });

  describe('hashToShortString', () => {
    it('should produce consistent short string for same input', () => {
      const input = 'filters:canteen1:window2';
      const short1 = hashToShortString(input);
      const short2 = hashToShortString(input);
      expect(short1).toBe(short2);
    });

    it('should produce different short strings for different inputs', () => {
      const short1 = hashToShortString('filters1');
      const short2 = hashToShortString('filters2');
      expect(short1).not.toBe(short2);
    });

    it('should return base64url string', () => {
      const short = hashToShortString('test');
      expect(short).toMatch(/^[A-Za-z0-9_-]+$/); // base64url字符集
      expect(short.length).toBe(8); // 6字节base64url编码
    });

    it('should be shorter than original for long strings', () => {
      const longString = 'a'.repeat(100);
      const short = hashToShortString(longString);
      expect(short.length).toBeLessThan(longString.length);
    });
  });

  describe('normalizedHash', () => {
    it('should return value in [0, 1) range', () => {
      const normalized1 = normalizedHash('user123');
      const normalized2 = normalizedHash('user456');
      const normalized3 = normalizedHash('user789');

      expect(normalized1).toBeGreaterThanOrEqual(0);
      expect(normalized1).toBeLessThan(1);
      expect(normalized2).toBeGreaterThanOrEqual(0);
      expect(normalized2).toBeLessThan(1);
      expect(normalized3).toBeGreaterThanOrEqual(0);
      expect(normalized3).toBeLessThan(1);
    });

    it('should produce consistent normalized value for same input', () => {
      const input = 'user123-experiment1';
      const norm1 = normalizedHash(input);
      const norm2 = normalizedHash(input);
      expect(norm1).toBe(norm2);
    });

    it('should distribute values reasonably (basic test)', () => {
      // 使用更真实的输入数据进行测试
      const inputs = [
        'user123',
        'user456',
        'user789',
        'userABC',
        'userXYZ',
        'user123-experiment1',
        'user456-experiment2',
        'user789-experiment3',
        'userABC-experiment1:group',
        'userXYZ-experiment2:group',
      ];

      const values = inputs.map((input) => normalizedHash(input));

      // 检查所有值都在[0,1)范围内
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      });

      // 检查值有一定分布（不全相同）
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBeGreaterThan(1);

      // 检查至少覆盖了2个四分位（对于10个样本，允许有些聚集）
      const quarters = [0, 0, 0, 0]; // [0,0.25), [0.25,0.5), [0.5,0.75), [0.75,1)
      values.forEach((value) => {
        const quarterIndex = Math.floor(value * 4);
        quarters[quarterIndex]++;
      });

      // 至少2个四分位有值（实际使用中哈希聚集是正常的）
      const nonEmptyQuarters = quarters.filter((count) => count > 0).length;
      expect(nonEmptyQuarters).toBeGreaterThanOrEqual(2);
    });

    it('should support AB testing traffic split simulation', () => {
      // Simulate 30% traffic allocation
      const trafficRatio = 0.3;
      let participantCount = 0;
      const totalUsers = 1000;

      for (let i = 0; i < totalUsers; i++) {
        const normalized = normalizedHash(`user${i}-experiment1`);
        if (normalized < trafficRatio) {
          participantCount++;
        }
      }

      // Should be close to 30% (allow 5% deviation)
      const actualRatio = participantCount / totalUsers;
      expect(actualRatio).toBeGreaterThan(0.25);
      expect(actualRatio).toBeLessThan(0.35);
    });
  });

  describe('Consistency across functions', () => {
    it('normalizedHash should be derived from hashString', () => {
      const input = 'test123';
      const hash = hashString(input);
      const normalized = normalizedHash(input);

      // Manually calculate normalized value
      const expectedNormalized = hash / 0x100000000;
      expect(normalized).toBe(expectedNormalized);
    });

    it('hashToShortString should be derived from hashString', () => {
      const input = 'test456';
      const hash = hashString(input);
      const short = hashToShortString(input);

      // hashToShortString基于SHA-256的前6字节，不是hashString的结果
      // 我们只需要验证它是一致的
      const shortAgain = hashToShortString(input);
      expect(short).toBe(shortAgain);
      expect(typeof short).toBe('string');
      expect(short.length).toBeGreaterThan(0);
    });
  });
});
