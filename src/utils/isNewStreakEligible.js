// utils/isNewStreakEligible.js
export const isNewStreakEligible = (lastStreakDate) => {
  if (!lastStreakDate) return true;

  const toISTDateString = (date) => {
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    return new Date(date.getTime() + istOffset).toISOString().split('T')[0];
  };

  const last = new Date(lastStreakDate);
  const now = new Date();

  const lastISTDate = toISTDateString(last);
  const nowISTDate = toISTDateString(now);

  return lastISTDate !== nowISTDate;
};
