import { GetMyPreferencesTool } from './get-my-preferences.tool';

describe('GetMyPreferencesTool', () => {
  it('returns only the authenticated user dietary settings', async () => {
    const profile = {
      getUserProfile: jest.fn().mockResolvedValue({
        data: {
          id: 'u1',
          openId: 'private-open-id',
          nickname: 'Account name',
          settings: { notificationSettings: {} },
          preferences: { avoidIngredients: ['香菜'], tagPreferences: ['清淡'] },
          allergens: ['花生'],
        },
      }),
      updateUserProfile: jest.fn(),
    };
    const tool = new GetMyPreferencesTool(profile as any);
    await expect(
      tool.execute({}, { userId: 'u1', sessionId: 's1' }),
    ).resolves.toEqual({
      preferences: { avoidIngredients: ['香菜'], tagPreferences: ['清淡'] },
      allergens: ['花生'],
    });
    expect(profile.getUserProfile).toHaveBeenCalledWith('u1');
    expect(profile.updateUserProfile).not.toHaveBeenCalled();
  });
});
