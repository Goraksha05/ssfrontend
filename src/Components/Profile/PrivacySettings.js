// components/Profile/PrivacySettings.js
import React, { useEffect, useState, useCallback, useContext } from "react";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";
import ProfileContext from "../../Context/Profile/ProfileContext";
import { Shield, Eye, EyeOff, Search, Calendar, MapPin, Mail, RotateCcw, Save } from "lucide-react";

const STORAGE_KEY = "sosholife_privacy_settings";
const DEFAULTS = {
  showEmail: true,
  showDOB: false,
  showLocation: true,
  allowSearchByName: true,
};

const SETTINGS_CONFIG = {
  showEmail: {
    label: "Show Email Address",
    description: "Allow other users to see your email on your profile.",
    icon: Mail,
    color: "#6366f1",
  },
  showDOB: {
    label: "Show Date of Birth",
    description: "Display your birthday on your public profile.",
    icon: Calendar,
    color: "#f59e0b",
  },
  showLocation: {
    label: "Show Location",
    description: "Share your city and hometown with others.",
    icon: MapPin,
    color: "#10b981",
  },
  allowSearchByName: {
    label: "Allow Name Search",
    description: "Let others find your profile by searching your name or username.",
    icon: Search,
    color: "#8b5cf6",
  },
};

const PrivacySettings = () => {
  const { profile, fetchProfile, handleEdit } = useContext(ProfileContext);
  const [settings, setSettings] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        if (profile) {
          const next = {
            showEmail: profile.showEmail ?? DEFAULTS.showEmail,
            showDOB: profile.showDOB ?? DEFAULTS.showDOB,
            showLocation: profile.showLocation ?? DEFAULTS.showLocation,
            allowSearchByName: profile.allowSearchByName ?? DEFAULTS.allowSearchByName,
          };
          if (mounted) {
            setSettings(next);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          }
          return;
        }

        const res = await apiRequest.get("/api/profile/privacy-settings");
        if (res?.data && mounted) {
          const next = { ...DEFAULTS, ...res.data };
          setSettings(next);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved && mounted) setSettings(JSON.parse(saved));
        } catch {
          if (mounted) setSettings(DEFAULTS);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [profile]);

  const persist = useCallback(async (next, key = null) => {
    setSaving(true);
    if (key) setSavingKey(key);
    try {
      await apiRequest.put("/api/profile/privacy-settings", next, {
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Privacy settings updated.");
      if (typeof fetchProfile === "function") fetchProfile().catch(() => {});
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      try {
        if (typeof handleEdit === "function") {
          await handleEdit(next);
          toast.success("Privacy settings updated.");
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          toast.info("Saved locally (server unavailable).");
        }
      } catch {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        toast.info("Saved locally.");
      }
    } finally {
      setSaving(false);
      setSavingKey(null);
    }
  }, [fetchProfile, handleEdit]);

  const handleToggle = (key) => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    persist(next, key);
  };

  const resetDefaults = () => {
    setSettings(DEFAULTS);
    persist(DEFAULTS);
  };

  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 18px',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: '#e0e7ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Shield size={18} style={{ color: '#6366f1' }} />
          </div>
          <div>
            <h5 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Privacy Settings</h5>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
              Control what others see on your profile
            </p>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: saving ? '#f59e0b' : loading ? '#94a3b8' : '#10b981' }}>
          {saving ? "Saving…" : loading ? "Loading…" : "Up to date"}
        </span>
      </div>

      {/* Settings List */}
      <div style={{ padding: '8px 0' }}>
        {Object.entries(settings).map(([key, value], index) => {
          const config = SETTINGS_CONFIG[key];
          const Icon = config?.icon;
          const isThisSaving = savingKey === key;

          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                borderBottom: index < Object.keys(settings).length - 1 ? '1px solid #f8fafc' : 'none',
                transition: 'background 0.15s ease',
                cursor: 'pointer',
              }}
              onClick={() => !saving && handleToggle(key)}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                {Icon && (
                  <div style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: `${config.color}18`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={17} style={{ color: config.color }} />
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                    {config?.label || key}
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 500, marginTop: 1 }}>
                    {config?.description}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                {isThisSaving && (
                  <div style={{
                    width: 14,
                    height: 14,
                    border: '2px solid #e2e8f0',
                    borderTopColor: '#6366f1',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                )}
                <div
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    background: value ? '#6366f1' : '#e2e8f0',
                    position: 'relative',
                    transition: 'background 0.2s ease',
                    flexShrink: 0,
                  }}
                  onClick={(e) => { e.stopPropagation(); if (!saving) handleToggle(key); }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 3,
                    left: value ? 23 : 3,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: '#fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    transition: 'left 0.2s ease',
                  }} />
                </div>
                {value ? (
                  <Eye size={14} style={{ color: '#10b981' }} />
                ) : (
                  <EyeOff size={14} style={{ color: '#94a3b8' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid #f1f5f9',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
      }}>
        <button
          onClick={resetDefaults}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'transparent',
            border: '1.5px solid #e2e8f0',
            borderRadius: 20,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 600,
            color: '#64748b',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={13} /> Reset
        </button>
        <button
          onClick={() => persist(settings)}
          disabled={saving}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 18px',
            background: '#6366f1',
            border: 'none',
            borderRadius: 20,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Save size={13} /> {saving ? "Saving…" : "Save All"}
        </button>
      </div>
    </div>
  );
};

export default PrivacySettings;