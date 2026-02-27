// components/Profile/NotificationSettings.js
import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";
import { useNotification } from "../../Context/NotificationContext";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import { Bell, Mail, Smartphone, MessageSquare, RotateCcw, Save, BellOff } from "lucide-react";

const STORAGE_KEY = "sosholife_notification_settings";
const DEFAULTS = { email: true, push: false, sms: false, mentionsOnly: true };

const SETTINGS_CONFIG = {
  email: {
    label: "Email Notifications",
    description: "Receive important updates and activity in your inbox.",
    icon: Mail,
    color: "#6366f1",
  },
  push: {
    label: "Push Notifications",
    description: "Get instant alerts directly in your browser or device.",
    icon: Bell,
    color: "#f59e0b",
  },
  sms: {
    label: "SMS Notifications",
    description: "Critical alerts via text message (carrier rates may apply).",
    icon: Smartphone,
    color: "#10b981",
  },
  mentionsOnly: {
    label: "Mentions Only Mode",
    description: "Only notify me when I'm mentioned or directly messaged.",
    icon: MessageSquare,
    color: "#8b5cf6",
  },
};

const NotificationSettings = () => {
  const { pushError, enablePush, disablePush } = useNotification();
  const { token } = useAuth();
  const [notifications, setNotifications] = useState(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!token) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          setNotifications(saved ? JSON.parse(saved) : DEFAULTS);
        } catch {
          setNotifications(DEFAULTS);
        }
        return;
      }

      setLoading(true);
      try {
        const res = await apiRequest.get("/api/profile/notification-settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!mounted) return;
        if (res?.data?.notifications) {
          const serverData = res.data.notifications;
          setNotifications((prev) => ({ ...prev, ...serverData }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
          return;
        }
      } catch {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (mounted) setNotifications(saved ? JSON.parse(saved) : DEFAULTS);
        } catch {
          if (mounted) setNotifications(DEFAULTS);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [token]);

  const persist = useCallback(async (next, key = null) => {
    setSaving(true);
    if (key) setSavingKey(key);
    try {
      if (token) {
        await apiRequest.put("/api/profile/notification-settings", next, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
        toast.success("Notification preferences saved.");
      } else {
        throw new Error("No token");
      }
    } catch {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      toast.info("Saved locally (server unavailable).");
    } finally {
      setSaving(false);
      setSavingKey(null);
    }
  }, [token]);

  const handleToggle = (key) => {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);

    if (key === "push") {
      if (!next.push) {
        disablePush?.().catch(() => toast.error("Could not disable push notifications"));
      } else {
        enablePush?.().catch(() => toast.error("Could not enable push notifications"));
      }
    }

    persist(next, key);
  };

  const resetDefaults = () => {
    setNotifications(DEFAULTS);
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
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Bell size={18} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h5 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Notification Settings</h5>
            <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
              Choose how and when you're notified
            </p>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: saving ? '#f59e0b' : loading ? '#94a3b8' : '#10b981' }}>
          {saving ? "Saving…" : loading ? "Loading…" : "Up to date"}
        </span>
      </div>

      {/* Settings List */}
      <div style={{ padding: '8px 0' }}>
        {Object.entries(notifications).map(([key, value], index) => {
          const config = SETTINGS_CONFIG[key];
          const Icon = config?.icon;
          const isThisSaving = savingKey === key;
          const isPushWithStatus = key === "push";

          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                borderBottom: index < Object.keys(notifications).length - 1 ? '1px solid #f8fafc' : 'none',
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
                    {isPushWithStatus && pushError && (
                      <span style={{ color: '#ef4444', marginLeft: 4 }}>({pushError})</span>
                    )}
                    {isPushWithStatus && !pushError && value && (
                      <span style={{ color: '#10b981', marginLeft: 6, fontWeight: 700 }}>• Active</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Toggle */}
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
                  <Bell size={14} style={{ color: '#10b981' }} />
                ) : (
                  <BellOff size={14} style={{ color: '#94a3b8' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
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
          onClick={() => persist(notifications)}
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

export default NotificationSettings;