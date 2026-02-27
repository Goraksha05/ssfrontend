// utils/getInitials.js
export function getInitials(name = '') {
  if (!name.trim()) return 'NA';

  const parts = name
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(p => p[0]?.toUpperCase() || '');

  if (parts.length === 0) return 'NA';
  if (parts.length === 1) return parts[0];

  return (parts[0] + parts[1]);
}
