import React, { useEffect, useState } from "react";
import apiRequest from "../../utils/apiRequest";
import { toast } from "react-toastify";

const Panel = () => {
  const [users, setUsers] = useState([]);
  const [uid, setUid] = useState("");
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(false);

  // users
  useEffect(() => {
    apiRequest
      .get("/api/admin/users")
      .then((r) => setUsers(r.data.users))
      .catch(() => toast.error("Failed to load users"));
  }, []);

  const loadRewards = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const { data } = await apiRequest.get("/api/admin/rewards");
      setRewards({
        referral: data.referralRewards.filter((x) => x.user._id === uid),
        post: data.postRewards.filter((x) => x.user._id === uid),
        streak: data.streakRewards.filter((x) => x.user._id === uid)
      });
    } finally {
      setLoading(false);
    }
  };

  const undo = async (type, slab) => {
    if (!window.confirm(`Undo ${type} slab "${slab}"?`)) return;
    try {
      await apiRequest.post("/api/admin/undo-reward", {
        userId: uid,
        type,
        slab
      });
      toast.success("Reverted!");
      loadRewards();
    } catch {
      toast.error("Undo failed");
    }
  };

  return (
    <section className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-bold">Undo Reward</h2>

      {/* selector */}
      <div className="flex flex-col sm:flex-row gap-4">
        <select
          value={uid}
          onChange={(e) => {
            setUid(e.target.value);
            setRewards(null);
          }}
          className="flex-1 border p-2 rounded"
        >
          <option value="">Select User</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} ({u.email})
            </option>
          ))}
        </select>

        <button
          onClick={loadRewards}
          disabled={!uid || loading}
          className="btn-primary px-4"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {/* list */}
      {rewards && (
        <div className="space-y-4">
          {["referral", "post", "streak"].map((t) => (
            <div key={t}>
              <h3 className="font-semibold capitalize mb-2">
                {t} ({rewards[t].length})
              </h3>
              {rewards[t].length ? (
                <ul className="space-y-1">
                  {rewards[t].map((r, i) => {
                    const slab = r.slabAwarded ?? r.streakslab;
                    return (
                      <li
                        key={i}
                        className="bg-white p-2 flex justify-between rounded shadow-sm"
                      >
                        <span>{slab}</span>
                        <button
                          onClick={() => undo(t, slab)}
                          className="text-red-600 hover:underline"
                        >
                          Undo
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-gray-500">No slabs</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default Panel;
