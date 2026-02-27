import React, { useState, useEffect } from 'react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AvatarUpload from '../shared/AvatarUpload';
import { Avatar } from '../ui/avatar';
import { useFriend } from "../../Context/Friend/FriendContext";
import getSocket from "../../WebSocket/WebSocketClient";
import apiRequest from '../../utils/apiRequest';
// NOTE: SERVER_URL is intentionally NOT prepended to API paths here.
// apiRequest already has the baseURL set; prepending SERVER_URL caused double-URL bugs.

function UpdateProfile() {
    const { fetchSuggestions } = useFriend();

    const [profile, setProfile] = useState({
        dob: '',
        currentcity: '',
        hometown: '',
        sex: 'Prefered not to mention',
        relationship: 'prefered not to mention',
        profileavatar: { URL: '', type: 'image' }
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                // Path only — apiRequest baseURL already includes the server origin.
                const res = await apiRequest.get('/api/profile/getprofile');
                setProfile(res.data?.profile || res.data);
            } catch (err) {
                console.error('Failed to fetch profile for update form:', err);
                toast.error('Failed to load profile data.');
            }
        };
        fetchProfile();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await apiRequest.put('/api/profile/updateprofile', profile);
            toast.success("Profile updated successfully!");

            await fetchSuggestions();

            const socket = getSocket();
            if (socket?.connected && profile) {
                socket.emit("user-online", {
                    userId: profile.user_id?._id || profile.user_id,
                    name: profile.user_id?.name || '',
                    hometown: profile.hometown,
                    currentcity: profile.currentcity
                });
            }
        } catch (error) {
            console.error('Profile update failed:', error);
            // Toast already shown by apiRequest interceptor for non-silenced calls.
        } finally {
            setSaving(false);
        }
    };

    const toSecureUrl = (url) =>
        url?.startsWith('https://') ? url : url?.replace(/^http:\/\//, 'https://');

    return (
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
            <form
                onSubmit={handleSubmit}
                className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-lg"
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Update Your Profile</h2>

                {profile.profileavatar?.URL && (
                    <div className="flex justify-center mb-4">
                        <Avatar src={toSecureUrl(profile.profileavatar.URL)} size={96} />
                    </div>
                )}

                <AvatarUpload
                    label="Change Avatar"
                    endpoint="avatar"
                    onUploadComplete={(newAvatarUrl) => {
                        if (newAvatarUrl) {
                            setProfile((prev) => ({
                                ...prev,
                                profileavatar: { ...prev.profileavatar, URL: newAvatarUrl }
                            }));
                        }
                    }}
                />

                <AvatarUpload
                    label="Change Cover"
                    endpoint="cover"
                    onUploadComplete={() => window.location.reload()}
                />

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                    <input
                        type="date"
                        name="dob"
                        className="input input-bordered w-full"
                        value={profile.dob ? profile.dob.substring(0, 10) : ''}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current City</label>
                    <input
                        type="text"
                        name="currentcity"
                        className="input input-bordered w-full"
                        value={profile.currentcity || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hometown</label>
                    <input
                        type="text"
                        name="hometown"
                        className="input input-bordered w-full"
                        value={profile.hometown || ''}
                        onChange={handleChange}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                        name="sex"
                        className="select select-bordered w-full"
                        value={profile.sex || ''}
                        onChange={handleChange}
                    >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="prefer not to mention">Prefer Not to Mention</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Relationship Status</label>
                    <select
                        name="relationship"
                        className="select select-bordered w-full"
                        value={profile.relationship || ''}
                        onChange={handleChange}
                    >
                        <option value="">Select status</option>
                        <option value="Single">Single</option>
                        <option value="Married">Married</option>
                        <option value="prefer not to mention">Prefer Not to Mention</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary w-full rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60"
                >
                    {saving ? 'Saving…' : 'Save Changes'}
                </button>
            </form>
            <ToastContainer position="top-right" autoClose={3000} />
        </div>
    );
}

export default UpdateProfile;