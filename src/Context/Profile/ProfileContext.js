// src/Context/Profile/ProfileContext.js
import { createContext, useContext } from 'react';

const ProfileContext = createContext(null);

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileState provider');
  return ctx;
};

export default ProfileContext;