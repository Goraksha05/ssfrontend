/**
 * modals/CreateAdSetModal.js
 *
 * Creates an AdSet under the selected campaign.
 * Fields match POST /api/ads/adset validation in adsRoutes.js:
 *   - campaignId (auto-filled)
 *   - name
 *   - startDate / endDate
 *   - placements (optional array)
 *   - dailyBudgetCap (optional)
 */

import { useState } from "react";
import { useAds } from "../../../Context/Ads/AdsContext";
import { useRegisterModal } from "../../../Context/ModalContext";
import ReactDOM from "react-dom";

const PLACEMENT_OPTIONS = ["feed", "stories", "search", "sidebar", "video"];

const defaultForm = {
  name: "",
  startDate: "",
  endDate: "",
  dailyBudgetCap: "",
  placements: [],
};

const CreateAdSetModal = ({ show, onClose, campaignId }) => {
  useRegisterModal(show);

  const { createAdSet, isCreatingAdSet, selectedCampaignId } = useAds();
  const resolvedCampaignId = campaignId || selectedCampaignId;

  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  if (!show) return null;

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = "Ad set name is required.";
    if (!form.startDate) e.startDate = "Start date is required.";
    if (!form.endDate) e.endDate = "End date is required.";
    if (form.startDate && form.endDate && form.endDate <= form.startDate)
      e.endDate = "End date must be after start date.";
    if (form.dailyBudgetCap && Number(form.dailyBudgetCap) < 0)
      e.dailyBudgetCap = "Budget cap cannot be negative.";
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const togglePlacement = (p) => {
    setForm((prev) => ({
      ...prev,
      placements: prev.placements.includes(p)
        ? prev.placements.filter((x) => x !== p)
        : [...prev.placements, p],
    }));
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    try {
      await createAdSet({
        campaignId: resolvedCampaignId,
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        ...(form.placements.length && { placements: form.placements }),
        ...(form.dailyBudgetCap !== "" && { dailyBudgetCap: Number(form.dailyBudgetCap) }),
      });
      setForm(defaultForm);
      setErrors({});
      onClose();
    } catch {
      // toast handled in AdsState
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return ReactDOM.createPortal(
    <div className="app-modal-overlay" onClick={handleOverlayClick}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3>Create Ad Set</h3>
          <button onClick={onClose} className="text-muted hover:text-primary text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-4">

          {/* Name */}
          <div>
            <label className="block text-sm mb-1">Ad Set Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Summer Sale - 18-35"
              className="w-full px-3 py-2 rounded border bg-input text-sm"
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Start Date *</label>
              <input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded border bg-input text-sm"
              />
              {errors.startDate && <p className="text-xs text-danger mt-1">{errors.startDate}</p>}
            </div>
            <div>
              <label className="block text-sm mb-1">End Date *</label>
              <input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded border bg-input text-sm"
              />
              {errors.endDate && <p className="text-xs text-danger mt-1">{errors.endDate}</p>}
            </div>
          </div>

          {/* Daily Budget Cap */}
          <div>
            <label className="block text-sm mb-1">Daily Budget Cap (₹) <span className="text-muted">optional</span></label>
            <input
              type="number"
              name="dailyBudgetCap"
              value={form.dailyBudgetCap}
              onChange={handleChange}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 rounded border bg-input text-sm"
            />
            {errors.dailyBudgetCap && <p className="text-xs text-danger mt-1">{errors.dailyBudgetCap}</p>}
          </div>

          {/* Placements */}
          <div>
            <label className="block text-sm mb-2">Placements <span className="text-muted">optional</span></label>
            <div className="flex flex-wrap gap-2">
              {PLACEMENT_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePlacement(p)}
                  className={`px-3 py-1 rounded-full text-xs border capitalize transition-base
                    ${form.placements.includes(p)
                      ? "bg-accent text-white border-accent"
                      : "border-border hover:border-accent hover:text-accent"
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover-lift text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isCreatingAdSet}
            className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift text-sm disabled:opacity-60"
          >
            {isCreatingAdSet ? "Creating…" : "Create Ad Set"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateAdSetModal;