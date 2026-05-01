/**
 * modals/CreateAdModal.js
 *
 * Creates an Ad (creative) under the selected AdSet.
 * Fields match POST /api/ads/adset/:adSetId/ad validation in adsRoutes.js:
 *   - link     (required, HTTPS URL)
 *   - format   (optional: single_image | carousel | video | text_only)
 *   - mediaType (optional: image | video | text)
 *   - headline / body (UX additions — backend accepts extra fields)
 */

import { useState } from "react";
import { useAds } from "../../../Context/Ads/AdsContext";
import { useRegisterModal } from "../../../Context/ModalContext";
import ReactDOM from "react-dom";

const FORMAT_OPTIONS = [
  { value: "single_image", label: "Single Image" },
  { value: "carousel",     label: "Carousel" },
  { value: "video",        label: "Video" },
  { value: "text_only",    label: "Text Only" },
];

const MEDIA_TYPE_OPTIONS = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "text",  label: "Text" },
];

const defaultForm = {
  link: "",
  format: "single_image",
  mediaType: "image",
  headline: "",
  body: "",
  mediaUrl: "",
};

const CreateAdModal = ({ show, onClose, adSetId }) => {
  useRegisterModal(show);

  const { createAd, isCreatingAd, selectedAdSetId } = useAds();
  const resolvedAdSetId = adSetId || selectedAdSetId;

  const [form, setForm] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  if (!show) return null;

  const validate = () => {
    const e = {};
    if (!form.link.trim()) {
      e.link = "Destination URL is required.";
    } else if (!form.link.startsWith("https://")) {
      e.link = "URL must start with https://";
    }
    if (!form.headline.trim()) e.headline = "Headline is required.";
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    try {
      await createAd({
        adSetId: resolvedAdSetId,
        data: {
          link:      form.link.trim(),
          format:    form.format,
          mediaType: form.mediaType,
          headline:  form.headline.trim(),
          body:      form.body.trim(),
          ...(form.mediaUrl.trim() && { mediaUrl: form.mediaUrl.trim() }),
        },
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

  const isTextOnly = form.format === "text_only" || form.mediaType === "text";

  return ReactDOM.createPortal(
    <div className="app-modal-overlay" onClick={handleOverlayClick}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <h3>Create Ad</h3>
          <button onClick={onClose} className="text-muted hover:text-primary text-xl leading-none">✕</button>
        </div>

        <div className="flex flex-col gap-4">

          {/* Format */}
          <div>
            <label className="block text-sm mb-2">Ad Format</label>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, format: f.value }))}
                  className={`px-3 py-2 rounded border text-sm text-left transition-base
                    ${form.format === f.value
                      ? "bg-accent text-white border-accent"
                      : "border-border hover:border-accent"
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Media Type */}
          <div>
            <label className="block text-sm mb-2">Media Type</label>
            <div className="flex gap-2">
              {MEDIA_TYPE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, mediaType: m.value }))}
                  className={`flex-1 px-3 py-2 rounded border text-sm transition-base
                    ${form.mediaType === m.value
                      ? "bg-accent text-white border-accent"
                      : "border-border hover:border-accent"
                    }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Headline */}
          <div>
            <label className="block text-sm mb-1">Headline *</label>
            <input
              name="headline"
              value={form.headline}
              onChange={handleChange}
              placeholder="e.g. Shop the Summer Sale — 50% Off"
              maxLength={90}
              className="w-full px-3 py-2 rounded border bg-input text-sm"
            />
            <div className="flex justify-between mt-0.5">
              {errors.headline
                ? <p className="text-xs text-danger">{errors.headline}</p>
                : <span />}
              <span className="text-xs text-muted">{form.headline.length}/90</span>
            </div>
          </div>

          {/* Body Copy */}
          <div>
            <label className="block text-sm mb-1">Body Copy <span className="text-muted">optional</span></label>
            <textarea
              name="body"
              value={form.body}
              onChange={handleChange}
              placeholder="Short description of your offer…"
              rows={3}
              maxLength={500}
              className="w-full px-3 py-2 rounded border bg-input text-sm resize-none"
            />
            <p className="text-xs text-muted text-right mt-0.5">{form.body.length}/500</p>
          </div>

          {/* Media URL — only when not text_only */}
          {!isTextOnly && (
            <div>
              <label className="block text-sm mb-1">Media URL <span className="text-muted">optional</span></label>
              <input
                name="mediaUrl"
                value={form.mediaUrl}
                onChange={handleChange}
                placeholder="https://cdn.example.com/banner.jpg"
                className="w-full px-3 py-2 rounded border bg-input text-sm"
              />
            </div>
          )}

          {/* Destination URL */}
          <div>
            <label className="block text-sm mb-1">Destination URL *</label>
            <input
              name="link"
              value={form.link}
              onChange={handleChange}
              placeholder="https://example.com/landing-page"
              className="w-full px-3 py-2 rounded border bg-input text-sm"
            />
            {errors.link && <p className="text-xs text-danger mt-1">{errors.link}</p>}
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
            disabled={isCreatingAd}
            className="px-4 py-2 bg-gradient text-white rounded shadow-md hover-lift text-sm disabled:opacity-60"
          >
            {isCreatingAd ? "Creating…" : "Create Ad"}
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default CreateAdModal;