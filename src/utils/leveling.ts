export const getRequiredXP = (level: number, streak: number): number => {
  const baseXP = 100;
  const streakBonus = streak * 10;
  return baseXP + level * 50 + streakBonus;
};