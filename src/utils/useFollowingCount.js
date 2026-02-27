// utils/useFollowingCount.js
import { useMemo } from 'react';

const useFollowingCount = (profile) => {
  return useMemo(() => {
    if (!profile || !Array.isArray(profile.following)) return 0;
    return profile.following.length;
  }, [profile]);
};

export default useFollowingCount;
