/**
 * components/Profile/DeleteAccount.js
 *
 * "Danger Zone" tab on the Profile page.
 *
 * States:
 *   idle        — no deletion pending; shows the "Delete Account" button
 *   confirming  — SweetAlert2 double-confirm dialog
 *   pending     — deletion requested; shows countdown + Cancel button
 *   cancelled   — just cancelled; returns to idle after brief message
 */

import React, { useState, useEffect, useCallback } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { Trash2, ShieldOff, RefreshCcw, Clock, AlertTriangle } from 'lucide-react';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../../Context/Authorisation/AuthContext';

// How many ms in a day
const DAY_MS = 24 * 60 * 60 * 1000;

// Formats ms remaining as "6d 23h 14m"
function formatCountdown(msRemaining) {
    if (msRemaining <= 0) return '0d 0h 0m';
    const totalSec = Math.floor(msRemaining / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
}

const DeleteAccount = () => {
    const { logout } = useAuth();

    const [status, setStatus] = useState(null);   // null | { requested, scheduledAt, daysRemaining }
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [
        // tick,
        setTick
    ] = useState(0);       // force re-render every minute for countdown

    // ── Fetch current deletion status on mount ──────────────────────────────────
    const fetchStatus = useCallback(async () => {
        try {
            const { data } = await apiRequest.get('/api/account/deletion-status');
            setStatus(data);
        } catch (err) {
            console.error('[DeleteAccount] fetchStatus:', err.message);
            setStatus({ requested: false });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);

    // ── Countdown ticker — updates every 60 s ────────────────────────────────────
    useEffect(() => {
        if (!status?.requested) return;
        const interval = setInterval(() => setTick(t => t + 1), 60_000);
        return () => clearInterval(interval);
    }, [status?.requested, setTick]);

    // ── Request deletion ──────────────────────────────────────────────────────────
    const handleDeleteRequest = async () => {
        // Step 1 — warn
        const step1 = await Swal.fire({
            title: 'Delete your account?',
            html: `
        <p style="margin-bottom:12px">This will schedule your account for <strong>permanent deletion in 7 days</strong>.</p>
        <p>Everything will be erased — your posts, messages, rewards, and profile. <strong>This cannot be undone</strong> after the grace period.</p>
        <p style="margin-top:12px;color:#6b7280;font-size:0.85rem">You can cancel within 7 days to restore your account.</p>
      `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Continue',
            cancelButtonText: 'Keep my account',
        });
        if (!step1.isConfirmed) return;

        // Step 2 — type "DELETE" to confirm
        const step2 = await Swal.fire({
            title: 'Final confirmation',
            html: `<p>Type <strong>DELETE</strong> to confirm you want to delete your account.</p>`,
            input: 'text',
            inputPlaceholder: 'DELETE',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Schedule deletion',
            cancelButtonText: 'Cancel',
            inputValidator: (value) => {
                if (value !== 'DELETE') return 'Please type DELETE (all caps) to confirm.';
            },
        });
        if (!step2.isConfirmed) return;

        try {
            const { data } = await apiRequest.post('/api/account/delete-request');
            setStatus({
                requested: true,
                scheduledAt: data.scheduledAt,
                daysRemaining: 7,
            });
            toast.warn('Account deletion scheduled. You have 7 days to change your mind.', {
                autoClose: 6000,
            });
            // Log the user out — their session is no longer valid for a pending-deletion account
            setTimeout(() => {
                logout();
            }, 3000);
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to schedule deletion. Please try again.';
            toast.error(msg);
        }
    };

    // ── Cancel deletion ───────────────────────────────────────────────────────────
    const handleCancelDeletion = async () => {
        const result = await Swal.fire({
            title: 'Cancel deletion?',
            text: 'Your account will be fully restored immediately.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#22c55e',
            confirmButtonText: 'Yes, keep my account',
            cancelButtonText: 'No, delete it',
        });
        if (!result.isConfirmed) return;

        setCancelling(true);
        try {
            await apiRequest.post('/api/account/cancel-deletion');
            setStatus({ requested: false });
            toast.success('Account deletion cancelled. Welcome back! 🎉', { autoClose: 5000 });
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to cancel deletion. Please try again.';
            toast.error(msg);
        } finally {
            setCancelling(false);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="delete-account-root">
                <div className="delete-account-loading">
                    <div className="loading-spinner" />
                    <p>Loading account status…</p>
                </div>
            </div>
        );
    }

    const isPending = status?.requested;
    const scheduledAt = isPending ? new Date(status.scheduledAt) : null;
    const msLeft = scheduledAt ? scheduledAt - Date.now() : 0;
    const pctLeft = scheduledAt ? Math.max(0, Math.min(100, (msLeft / (7 * DAY_MS)) * 100)) : 0;

    return (
        <div className="delete-account-root">

            {/* ── Section header ─────────────────────────────────────────────────── */}
            <div className="delete-account-header">
                <ShieldOff size={22} className="delete-account-header-icon" />
                <h3>Danger Zone</h3>
            </div>

            {/* ── Pending-deletion banner ────────────────────────────────────────── */}
            {isPending && (
                <div className="deletion-pending-card">
                    <div className="deletion-pending-top">
                        <AlertTriangle size={20} className="deletion-warning-icon" />
                        <span className="deletion-pending-label">Account deletion scheduled</span>
                    </div>

                    <p className="deletion-pending-desc">
                        Your account will be <strong>permanently deleted</strong> on{' '}
                        <strong>{scheduledAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>.
                        Log back in before then to cancel.
                    </p>

                    {/* Countdown */}
                    <div className="deletion-countdown">
                        <Clock size={16} />
                        <span className="deletion-countdown-text">
                            Time remaining: <strong>{formatCountdown(msLeft)}</strong>
                        </span>
                    </div>

                    {/* Progress bar */}
                    <div className="deletion-progress-track">
                        <div
                            className="deletion-progress-bar"
                            style={{ width: `${pctLeft}%` }}
                        />
                    </div>
                    <p className="deletion-progress-legend">
                        {Math.ceil(msLeft / DAY_MS)} of 7 days remaining
                    </p>

                    {/* Cancel button */}
                    <button
                        className="deletion-cancel-btn"
                        onClick={handleCancelDeletion}
                        disabled={cancelling}
                    >
                        {cancelling ? (
                            <>
                                <div className="btn-spinner" />
                                Cancelling…
                            </>
                        ) : (
                            <>
                                <RefreshCcw size={16} />
                                Cancel Deletion — Keep My Account
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ── Idle state — delete button ─────────────────────────────────────── */}
            {!isPending && (
                <div className="delete-account-card">
                    <div className="delete-account-info">
                        <h4 className="delete-account-title">Delete Account</h4>
                        <p className="delete-account-desc">
                            Once you request deletion, you have <strong>7 days</strong> to change your mind.
                            After that, your account, posts, messages, friends, rewards, and all data will
                            be <strong>permanently and irreversibly erased</strong> from SoShoLife.
                        </p>
                        <ul className="delete-account-consequences">
                            <li>🗑️ All your posts and comments will be deleted</li>
                            <li>💬 Your chat history will be anonymised</li>
                            <li>🎁 All earned rewards and wallet balance will be forfeited</li>
                            <li>👥 You will be removed from friends' lists</li>
                            <li>🔒 Your account cannot be reactivated after 7 days</li>
                        </ul>
                    </div>

                    <button
                        className="delete-account-btn"
                        onClick={handleDeleteRequest}
                    >
                        <Trash2 size={16} />
                        Request Account Deletion
                    </button>
                </div>
            )}
        </div>
    );
};

export default DeleteAccount;