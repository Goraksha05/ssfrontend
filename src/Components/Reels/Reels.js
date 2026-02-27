import React, { useContext } from "react";
import postContext from "../../Context/Posts/PostContext";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";

const BACKEND_URL = process.env.REACT_APP_SERVER_URL || process.env.REACT_APP_BACKEND_URL;

function Reels() {
    const { statePosts, toggleLikePost } = useContext(postContext);

    const token = localStorage.getItem("token");
    let userId = null;
    try {
        const decoded = token ? jwtDecode(token) : null;
        userId = decoded?.user?.id;
    } catch (e) {
        console.warn("Invalid token", e);
    }

    const reels = statePosts.filter(post =>
        post.media?.some(media => media.type === "video")
    );

    const handleFollow = async (authorId) => {
        try {
            const res = await apiRequest.put(
                `/api/profile/follow/${authorId}`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            toast.success(res.data.isFollowing ? "Followed!" : "Unfollowed!");
        } catch (err) {
            console.error("Follow/unfollow failed", err);
            toast.error("Action failed");
        }
    };

    return (
        <div className="container">
            <h2 className="text-center mb-4">🎬 Reels</h2>

            {reels.length === 0 ? (
                <p className="text-center">No reels available.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {reels.map((post) => {
                        const author = post.user_id || {};
                        const isLiked = post.likes?.includes(userId);
                        const videoMedia = post.media?.find(m => m.type === "video");
                        const videoUrl = videoMedia?.url?.startsWith("http")
                            ? videoMedia.url
                            : `${BACKEND_URL}${videoMedia?.url}`;

                        return (
                            <div key={post._id} className="card shadow rounded overflow-hidden">
                                {videoUrl && (
                                    <video
                                        controls
                                        className="w-full h-64 object-cover"
                                        preload="metadata"
                                        loading="lazy"
                                    >
                                        <source src={videoUrl} type="video/mp4" />
                                        <source src={videoUrl} type="video/x-matroska" /> {/* MKV */}
                                        <source src={videoUrl} type="video/webm" /> {/* WebM */}
                                        <source src={videoUrl} type="video/quicktime" /> {/* MOV */}
                                        Your browser does not support the video tag.
                                    </video>
                                )}

                                <div className="p-3">
                                    <div className="flex justify-between items-center mb-2">
                                        <strong>{author.name || "Unknown"}</strong>
                                        {userId && userId !== author._id && (
                                            <button
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => handleFollow(author._id)}
                                            >
                                                Follow
                                            </button>
                                        )}
                                    </div>

                                    <p className="text-muted text-sm">{post.post}</p>

                                    <div className="flex items-center mt-2">
                                        <button
                                            className="btn btn-link text-danger p-0 me-2"
                                            onClick={() => toggleLikePost(post._id)}
                                        >
                                            <i className={`fas fa-heart ${isLiked ? "text-danger" : "text-muted"}`} />
                                        </button>
                                        <small>{post.likes.length} Likes</small>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Reels;