import React from "react";

const AdsMetrics = ({ campaigns = [] }) => {
  const totalSpend = campaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);

  const ctr =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(2)
      : 0;

  const cpc =
    totalClicks > 0
      ? (totalSpend / totalClicks).toFixed(2)
      : 0;

  return (
    <div className="grid grid-cols-4 gap-4">

      <Metric title="Spend" value={`₹${totalSpend}`} />
      <Metric title="Clicks" value={totalClicks} />
      <Metric title="CTR" value={`${ctr}%`} />
      <Metric title="CPC" value={`₹${cpc}`} />

    </div>
  );
};

const Metric = ({ title, value }) => (
  <div className="bg-card border rounded-lg p-4 shadow-sm hover-lift">

    <p className="text-xs text-muted">{title}</p>

    <h3 className="mt-1 text-lg">{value}</h3>

  </div>
);

export default AdsMetrics;