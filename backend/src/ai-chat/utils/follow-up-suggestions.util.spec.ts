import { PromptBuilder } from './prompt-builder.util';
import {
  buildFollowUpMessages,
  parseFollowUpSuggestions,
} from './follow-up-suggestions.util';

describe('contextual follow-up suggestions', () => {
  it('selects English follow-ups without changing original conversation content', () => {
    const messages = buildFollowUpMessages(
      [{ role: 'user', content: [{ type: 'text', data: '午餐' }] }],
      'en',
    );
    expect(messages[0].content).toContain('英文');
    expect(messages[0].content).not.toContain('中文问题');
    expect(messages[1].content).toContain('午餐');
    for (const scene of ['general_chat', 'meal_planner', 'dish_critic']) {
      const prompt = PromptBuilder.getSystemPrompt(scene, new Date(), 'en');
      expect(prompt).toContain('Response language: English');
      expect(prompt).toContain('nameEn');
      expect(prompt).toContain('草稿只供确认，不代表计划已保存');
    }
  });
  it('includes recent questions, answers and visible card data, within a bounded context', () => {
    const messages = buildFollowUpMessages([
      ...Array.from({ length: 8 }, (_, index) => ({
        role: 'user',
        content: [{ type: 'text', data: `old-${index}` }],
      })),
      { role: 'user', content: [{ type: 'text', data: '想吃清淡的午餐' }] },
      {
        role: 'assistant',
        content: [
          {
            type: 'card_dish',
            data: [{ dish: { name: '香菇鸡肉饭' }, canteenName: '第二食堂' }],
          },
        ],
      },
    ]);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('必须由卡片按钮确认');
    expect(messages[1].content).toContain('香菇鸡肉饭');
    expect(messages[1].content).toContain('想吃清淡的午餐');
    expect(messages[1].content).not.toContain('old-0');
    const bounded = buildFollowUpMessages([
      {
        role: 'assistant',
        content: [{ type: 'text', data: 'x'.repeat(100000) }],
      },
    ]);
    expect(bounded[1].content!.length).toBeLessThan(7000);
  });

  it('accepts only concise distinct questions, without inventing fallback content', () => {
    expect(
      parseFollowUpSuggestions(
        '```json\n{"suggestions":["  哪道更清淡？  ","哪道更清淡？","  ",42,"去哪里买？","有素食选择吗？","再换一家？"]}\n```',
      ),
    ).toEqual(['哪道更清淡？', '去哪里买？', '有素食选择吗？']);
    expect(
      parseFollowUpSuggestions('{"suggestions":["' + '很'.repeat(61) + '"]}'),
    ).toEqual([]);
    expect(parseFollowUpSuggestions('not json')).toEqual([]);
    expect(parseFollowUpSuggestions('{"suggestions":"换一家"}')).toEqual([]);
  });
});
