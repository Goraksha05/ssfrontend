// utils/useFollowersCount.js
import { useMemo } from 'react';

const useFollowersCount = (profile) => {
  return useMemo(() => {
    if (!profile || !Array.isArray(profile.followers)) return 0;
    return profile.followers.length;
  }, [profile]);
};

export default useFollowersCount;
