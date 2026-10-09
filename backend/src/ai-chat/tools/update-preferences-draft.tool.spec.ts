import { UpdatePreferencesTool } from './update-preferences.tool';

describe('UpdatePreferencesTool confirmation drafts', () => {
  const context = { userId: 'u1', sessionId: 's1', scene: 'general_chat' };
  const current = {
    tagPreferences: ['清淡'],
    priceRange: { min: 0, max: 50 },
    tastePreferences: {
      spicyLevel: 0,
      sweetness: 0,
      saltiness: 0,
      oiliness: 0,
    },
    avoidIngredients: ['香菜'],
  };
  let profile: any;
  let tool: UpdatePreferencesTool;

  beforeEach(() => {
    profile = {
      getUserProfile: jest.fn().mockResolvedValue({
        data: {
          preferences: current,
          allergens: ['花生'],
          openId: 'private-id',
        },
      }),
      updateUserProfile: jest.fn(),
    };
    tool = new UpdatePreferencesTool(profile);
  });

  it('produces a confirmation draft without writing any preferences', async () => {
    const draft: any = await tool.execute(
      { avoidIngredients: ['香菜', '葱'] },
      context,
    );
    expect(profile.getUserProfile).toHaveBeenCalledWith('u1');
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
    expect(draft).toMatchObject({
      previewData: {
        before: { preferences: { avoidIngredients: ['香菜'] } },
        after: { preferences: { avoidIngredients: ['香菜', '葱'] } },
      },
      confirmAction: {
        api: '/user/profile',
        method: 'PUT',
        body: { preferences: { avoidIngredients: ['香菜', '葱'] } },
      },
    });
    expect(JSON.stringify(draft)).not.toContain('private-id');
  });

  it('preserves the complete live group for changed taste or price fields', async () => {
    const draft: any = await tool.execute(
      {
        tastePreferences: { spicyLevel: 2 },
        priceRange: { min: 5, max: 25 },
      },
      context,
    );
    expect(draft.previewData.before.preferences).toEqual({
      tastePreferences: current.tastePreferences,
      priceRange: current.priceRange,
    });
    expect(draft.confirmAction.body.preferences).toEqual({
      tastePreferences: { spicyLevel: 2 },
      priceRange: { min: 5, max: 25 },
    });
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
  });

  it('keeps explicit empty lists so users can confirm removing restrictions', async () => {
    const draft: any = await tool.execute(
      { allergens: [], avoidIngredients: [] },
      context,
    );
    expect(draft.previewData.before).toEqual({
      allergens: ['花生'],
      preferences: { avoidIngredients: ['香菜'] },
    });
    expect(draft.confirmAction.body).toEqual({
      allergens: [],
      preferences: { avoidIngredients: [] },
    });
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
  });

  it('does not keep aliases to the fetched profile or model input', async () => {
    const input = { tagPreferences: ['清淡', '家常菜'] };
    const draft: any = await tool.execute(input, context);
    input.tagPreferences.push('changed');
    expect(draft.confirmAction.body.preferences.tagPreferences).toEqual([
      '清淡',
      '家常菜',
    ]);
    expect(draft.previewData.before.preferences.tagPreferences).not.toBe(
      current.tagPreferences,
    );
  });

  it('rejects an inverted price range before issuing a draft', async () => {
    await expect(
      tool.execute({ priceRange: { min: 30, max: 10 } }, context),
    ).rejects.toThrow('最低价格不能高于最高价格');
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
  });

  it('rejects an empty preference change', async () => {
    await expect(tool.execute({}, context)).rejects.toThrow(
      '没有可确认的偏好变更',
    );
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
  });
});
