import { useAds } from "../../Context/Ads/AdsContext";

export default function Campaigns() {
  const { campaigns = [] } = useAds();

  if (!campaigns.length) {
    return (
      <div className="text-center py-6">
        <p className="text-muted">No campaigns yet</p>
      </div>
    );
  }

  return (
    <table className="w-full text-sm">

      <thead>
        <tr className="border-b text-muted">
          <th className="p-2 text-left">Campaign</th>
          <th>Status</th>
          <th>Budget</th>
          <th>Spend</th>
          <th></th>
        </tr>
      </thead>

      <tbody>
        {campaigns.map((c) => (
          <tr key={c._id} className="border-b hover:bg-hover">

            <td className="p-3">{c.campaignName}</td>

            <td>
              <span className="text-success">
                {c.status || "Active"}
              </span>
            </td>

            <td>₹{c.budget}</td>
            <td>₹{c.spend || 0}</td>

            <td>
              <button className="text-accent hover-underline">
                Edit
              </button>
            </td>

          </tr>
        ))}
      </tbody>

    </table>
  );
}