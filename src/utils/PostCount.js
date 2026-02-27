// utils/usePostCount.js
import { useMemo } from 'react';

const usePostCount = (posts, userId) => {
  return useMemo(() => {
    if (!posts || !userId) return 0;

    // Normalise the viewer's own ID to a plain string once
    const currentUserId = (userId?._id || userId?.id || userId)?.toString();
    if (!currentUserId) return 0;

    return posts.filter(post => {
      /*
       * `user_id` can arrive in two different shapes:
       *
       * 1. Populated object (fetchallposts uses .populate('user_id', ...))
       *       post.user_id = { _id: "abc123", name: "...", subscription: {...} }
       *
       * 2. Raw ObjectId / string (newly added post from addPost, which returns
       *    the unsaved mongoose doc before population)
       *       post.user_id = "abc123"  |  ObjectId("abc123")
       *
       * We extract the id string from whichever shape is present.
       */
      const postOwnerId = (
        post.user_id?._id   ||   // populated object  ← most common for fetched posts
        post.user_id         ||   // raw ObjectId / string ← newly added posts
        post.user?._id       ||   // alternative field name (populated)
        post.user            ||   // alternative field name (raw)
        post.userId              // any other alias
      )?.toString();

      return postOwnerId === currentUserId;
    }).length;
  }, [posts, userId]);
};

export default usePostCount;