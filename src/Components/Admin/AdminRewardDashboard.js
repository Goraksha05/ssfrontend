import React, { useEffect, useState, memo } from "react";
import apiRequest from "../../utils/apiRequest";
import { utils, writeFile } from "xlsx";
import { toast } from "react-toastify";
import {
  ResponsiveContainer,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar
} from "recharts";

const formatDate = (d) =>
  new Date(d).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });

function aggregate(rewards, key) {
  return rewards.reduce((acc, r) => {
    const slab = r[key];
    if (!slab) return acc;
    acc[slab] = (acc[slab] || 0) + 1;
    return acc;
  }, {});
}

const AdminRewardDashboard = ({ filterByUserId }) => {
  const [data, setData] = useState(null);
  const [viewJSON, setViewJSON] = useState(false);

  useEffect(() => {
    apiRequest
      .get("/api/admin/rewards")
      .then((r) => setData(r.data))
      .catch(() => toast.error("Failed to load rewards"));
  }, []);

  if (!data) return <p>Loading…</p>;

  const chartInput = ["referral", "post", "streak"].reduce((obj, type) => {
    const key = `${type}Rewards`;
    const rewards = data[key];
    obj[type] = Object.entries(
      aggregate(rewards, type === "streak" ? "streakslab" : "slabAwarded")
    ).map(([slab, count]) => ({ slab, count }));
    return obj;
  }, {});

  const exportCSV = (scope = "all") => {
    const rows = ["referral", "post", "streak"]
      .filter((t) => scope === "all" || scope === t)
      .flatMap((type) =>
        (data[`${type}Rewards`] || [])
          .filter((r) => !filterByUserId || r.user?._id === filterByUserId)
          .map((r) => ({
            Type: type,
            Email: r.user?.email ?? "Unknown",
            Slab: r.slabAwarded ?? r.streakslab,
            Date: formatDate(r.createdAt)
          }))
      );

    if (!rows.length) return toast.info("Nothing to export!");
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Rewards");
    writeFile(wb, `${scope}_rewards_${Date.now()}.xlsx`);
  };

  return (
    <section className="space-y-8">
      {/* header */}
      <div className="flex flex-col md:flex-row md:justify-between gap-3">
        <h2 className="text-2xl font-bold">Reward Dashboard</h2>

        <div className="flex gap-2">
          <button
            onClick={() => exportCSV("all")}
            className="btn-primary mx-2 px-4 py-2"
          >
            Export All
          </button>
          <button
            onClick={() => setViewJSON((v) => !v)}
            className="btn-secondary px-3 py-2"
          >
            {viewJSON ? "Hide raw JSON" : "Show raw JSON"}
          </button>
        </div>
      </div>

      {/* charts */}
      <div className="grid gap-6 mb-3 md:grid-cols-2 xl:grid-cols-3">
        {["Referral", "Post", "Streak"].map((t) => (
          <div
            key={t}
            className="bg-dark mb-3 mt-2 rounded shadow p-4 flex flex-col gap-4"
          >
            <h3 className="font-semibold capitalize">{t} Rewards</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartInput[t]}>
                <XAxis dataKey="slab" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>

      {/* tables */}
      {["referral", "post", "streak"].map((type) => {
        const rewards = data[`${type}Rewards`]
          .filter((r) => !filterByUserId || r.user?._id === filterByUserId)
          .slice(0, 40); // 🏎 limit for perf; adjust as needed

        const slabKey = type === "streak" ? "streakslab" : "slabAwarded";
        return (
          <details key={type} className="bg-black mb-2 rounded shadow p-4">
            <summary className="font-semibold capitalize cursor-pointer">
              {type} Rewards ({rewards.length})
            </summary>

            {rewards.length ? (
              <div className="overflow-auto mt-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="p-2 text-left">User</th>
                      <th className="p-2 text-left">Slab</th>
                      <th className="p-2 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rewards.map((r, i) => (
                      <tr
                        key={i}
                        className="odd:bg-white even:bg-slate-50 border-b"
                      >
                        <td className="p-2">{r.user?.email || "Unknown"}</td>
                        <td className="p-2">{r[slabKey]}</td>
                        <td className="p-2">{formatDate(r.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 mt-2">No records</p>
            )}
          </details>
        );
      })}

      {viewJSON && (
        <pre className="bg-slate-200 p-4 rounded overflow-auto text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
};

export default memo(AdminRewardDashboard);
