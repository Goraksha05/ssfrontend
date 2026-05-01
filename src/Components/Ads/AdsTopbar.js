import React, { useState } from "react";
import { useAds } from "../../Context/Ads/AdsContext";

const AdsTopbar = ({ onCreate }) => {
  const { setCampaignFilters } = useAds();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const handleSearch = (e) => {
    const value = e.target.value;

    setSearch(value);

    setCampaignFilters((prev) => ({
      ...prev,
      search: value,
    }));
  };

  const handleFilter = (e) => {
    const value = e.target.value;

    setStatus(value);

    setCampaignFilters((prev) => ({
      ...prev,
      status: value,
    }));
  };

  return (
    <div className="flex justify-between items-center px-5 py-3 border-b bg-card">

      <div className="flex items-center gap-3">

        <input
          value={search}
          onChange={handleSearch}
          placeholder="Search campaigns..."
          className="px-3 py-2 rounded border bg-input text-sm w-60"
        />

        <select
          value={status}
          onChange={handleFilter}
          className="px-3 py-2 rounded border bg-input text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>

      </div>

      <div className="flex items-center gap-3">

        <button className="px-3 py-2 border rounded hover-lift">
          Export
        </button>

        <button
          onClick={onCreate}
          className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift"
        >
          + Create Campaign
        </button>

      </div>
    </div>
  );
};

export default AdsTopbar;