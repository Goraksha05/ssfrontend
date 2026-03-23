// utils/isNewStreakEligible.js

/**
 * Returns true if the user is eligible to log a new streak today (IST calendar day).
 *
 * @param {string|Date|null} lastStreakDate  ISO string or Date of the last logged streak
 * @returns {boolean}
 */
export const isNewStreakEligible = (lastStreakDate) => {
  if (!lastStreakDate) return true;

  // Use Intl.DateTimeFormat with the India timezone to extract the IST
  // calendar date. This correctly handles the UTC→IST conversion without
  // manual offset arithmetic.
  const toISTDateString = (date) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    }).format(date);
    // en-CA locale produces YYYY-MM-DD format natively — no string manipulation needed
  };

  const last = new Date(lastStreakDate);
  if (isNaN(last.getTime())) return true; // treat unparseable date as no streak yet

  const now = new Date();

  const lastISTDate = toISTDateString(last);
  const nowISTDate  = toISTDateString(now);

  return lastISTDate !== nowISTDate;
};