import React, { useState } from "react";
import { useAds } from "../../../Context/Ads/AdsContext";
import { toast } from "react-toastify";
import BaseModal from "../../Common/BaseModal";

const CreateCampaignModal = ({ show, onClose, accountId, pages = [] }) => {
  const { createCampaign } = useAds();

  const [form, setForm] = useState({
    adPageId: "",
    campaignName: "",
    objective: "traffic",
    budget: "",
    startDate: "",
    endDate: "",
  });

  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    if (!form.campaignName.trim()) {
      return toast.error("Campaign name required");
    }

    if (!form.adPageId) {
      return toast.error("Select Ad Page");
    }

    if (!form.budget || form.budget < 100) {
      return toast.error("Minimum budget ₹100");
    }

    if (!form.startDate || !form.endDate) {
      return toast.error("Select dates");
    }

    try {
      setLoading(true);

      await createCampaign({
        ...form,
        adAccountId: accountId,
        budget: Number(form.budget),
      });

      toast.success("Campaign created!");
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <BaseModal onClose={onClose}>
      <div className="w-full max-w-xl p-6 animate-scaleIn">

        {/* HEADER */}
        <div className="mb-5">
          <h3>Create Campaign</h3>
          <p className="text-sm text-muted">
            Set up your campaign details and budget
          </p>
        </div>

        {/* FORM */}
        <div className="flex flex-col gap-4">

          {/* Campaign Name */}
          <div>
            <label className="text-sm text-muted">Campaign Name</label>
            <input
              className="mt-1 p-3 w-full rounded border bg-input"
              placeholder="Enter campaign name"
              name="campaignName"
              value={form.campaignName}
              onChange={handleChange}
            />
          </div>

          {/* Page + Objective */}
          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="text-sm text-muted">Ad Page</label>
              <select
                className="mt-1 p-3 w-full rounded border bg-input"
                name="adPageId"
                value={form.adPageId}
                onChange={handleChange}
              >
                <option value="">Select Page</option>
                {pages.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.pageName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-muted">Objective</label>
              <select
                className="mt-1 p-3 w-full rounded border bg-input"
                name="objective"
                value={form.objective}
                onChange={handleChange}
              >
                <option value="traffic">Traffic</option>
                <option value="engagement">Engagement</option>
                <option value="awareness">Awareness</option>
              </select>
            </div>

          </div>

          {/* Budget */}
          <div>
            <label className="text-sm text-muted">Daily Budget (₹)</label>
            <input
              type="number"
              className="mt-1 p-3 w-full rounded border bg-input"
              placeholder="Minimum ₹100"
              name="budget"
              value={form.budget}
              onChange={handleChange}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="text-sm text-muted">Start Date</label>
              <input
                type="date"
                className="mt-1 p-3 w-full rounded border bg-input"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="text-sm text-muted">End Date</label>
              <input
                type="date"
                className="mt-1 p-3 w-full rounded border bg-input"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
              />
            </div>

          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 mt-6">

          <button
            className="px-4 py-2 border rounded hover-lift"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Campaign"}
          </button>

        </div>
      </div>
    </BaseModal>
  );
};

export default CreateCampaignModal;