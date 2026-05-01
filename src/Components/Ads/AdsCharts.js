import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AdsCharts = ({ campaigns = [] }) => {
  // mock aggregation (replace later with real daily data)
  const data = campaigns.map((c, i) => ({
    name: `C${i + 1}`,
    spend: c.spend || 0,
    clicks: c.clicks || 0,
  }));

  return (
    <div className="bg-card border rounded-lg p-4 shadow-card">

      <h4 className="mb-3">Performance Overview</h4>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="name" stroke="#888" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="spend" stroke="#0ea5e9" />
            <Line type="monotone" dataKey="clicks" stroke="#22c55e" />
          </LineChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
};

export default AdsCharts;