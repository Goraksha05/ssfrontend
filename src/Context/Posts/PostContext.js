import { createContext, useContext } from 'react';

const PostContext = createContext(null);

export const usePost = () => {
  const ctx = useContext(PostContext);
  if (!ctx) throw new Error('usePost must be used within a PostState provider');
  return ctx;
};

export default PostContext;