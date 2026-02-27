import React from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const fetchClaims = async () => {
  const token = localStorage.getItem("token");
  const { data } = await axios.get("/api/admin/reward-claims", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return data;
};

const ClaimDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["claims"],
    queryFn: fetchClaims,
    staleTime: 60_000
  })

  if (isLoading) return <p>Loading…</p>;
  if (!data || data.length === 0) return <p>No reward claims found.</p>;

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold">Reward Claim Monitor</h2>
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100">
              <th className="p-2 text-left">User</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Milestone</th>
              <th className="p-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c, i) => (
              <tr key={i}>
                <td>{c.user?.name || "Unknown"}</td>
                <td>{c.type}</td>
                <td>{c.milestone}</td>
                <td>{new Date(c.date).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ClaimDashboard;
