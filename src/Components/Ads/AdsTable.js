import { useState } from "react";

const Toggle = ({ status = "active", onToggle }) => {
  const active = status === "active";

  return (
    <button
      onClick={onToggle}
      className={`w-10 h-5 flex items-center rounded-full p-1 transition
        ${active ? "bg-success" : "bg-border"}
      `}
    >
      <div
        className={`w-4 h-4 bg-white rounded-full transition-transform
          ${active ? "translate-x-5" : ""}
        `}
      />
    </button>
  );
};

const AdsTable = ({ campaigns = [], onToggleStatus }) => {
  const [selected, setSelected] = useState([]);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selected.length === campaigns.length) {
      setSelected([]);
    } else {
      setSelected(campaigns.map((c) => c._id));
    }
  };

  return (
    <div>

      {/* BULK BAR */}
      {selected.length > 0 && (
        <div className="mb-3 p-3 bg-hover rounded flex justify-between">
          <span>{selected.length} selected</span>

          <div className="flex gap-2">
            <button className="px-3 py-1 border rounded">Pause</button>
            <button className="px-3 py-1 border rounded">Delete</button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">

        <thead>
          <tr className="border-b text-muted">
            <th>
              <input
                type="checkbox"
                onChange={selectAll}
                checked={selected.length === campaigns.length}
              />
            </th>
            <th className="text-left">Campaign</th>
            <th>Status</th>
            <th>Budget</th>
            <th>Spend</th>
            <th>Clicks</th>
          </tr>
        </thead>

        <tbody>
          {campaigns.map((c) => (
            <tr key={c._id} className="border-b hover:bg-hover">

              <td>
                <input
                  type="checkbox"
                  checked={selected.includes(c._id)}
                  onChange={() => toggleSelect(c._id)}
                />
              </td>

              <td className="p-2">{c.campaignName}</td>

              <td>
                <Toggle
                  status={c.status}
                  onToggle={() => onToggleStatus?.(c)}
                />
              </td>

              <td>₹{c.budget}</td>
              <td>₹{c.spend || 0}</td>
              <td>{c.clicks || 0}</td>

            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdsTable;