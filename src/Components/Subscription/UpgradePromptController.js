/**
 * UpgradePromptController.js
 *
 * Drop-in orchestration component.
 * Mount this ONCE near the root of your app (inside all required providers)
 * and it handles everything automatically:
 *
 *   • Watches auth state via useUpgradePrompt()
 *   • Renders the modal via the imperative openModal() / ModalContext API
 *   • Wires up the subscription flow via SubscriptionContext.openSubscription()
 *
 * ── INTEGRATION STEPS ────────────────────────────────────────────────────────
 *
 * 1. Add Google Fonts link to public/index.html (inside <head>):
 *      <link rel="preconnect" href="https://fonts.googleapis.com" />
 *      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin />
 *      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
 *
 * 2. Ensure provider nesting order in App.js (or index.js):
 *
 *      <AuthProvider>
 *        <SubscriptionProvider>
 *          <ModalProvider>          ← must wrap UpgradePromptController
 *            <UpgradePromptController />
 *            <App />
 *          </ModalProvider>
 *        </SubscriptionProvider>
 *      </AuthProvider>
 *
 * 3. Mount once:
 *      import UpgradePromptController from './components/Subscription/UpgradePromptController';
 *      // (already done if you followed step 2)
 *
 * 4. Use the banner anywhere (optional):
 *      import UpgradePrompt from './components/Subscription/UpgradePrompt';
 *
 *      // Standard banner (dismissible)
 *      <UpgradePrompt onDismiss={() => {}} />
 *
 *      // Compact one-liner
 *      <UpgradePrompt compact onDismiss={() => {}} />
 *
 *      // Permanent (no dismiss)
 *      <UpgradePrompt />
 *
 * ── PROVIDER REQUIREMENTS ────────────────────────────────────────────────────
 *   AuthProvider         src/Context/Authorisation/AuthContext.js
 *   SubscriptionProvider src/Context/Subscription/SubscriptionContext.js
 *   ModalProvider        src/Context/ModalContext.js
 *
 * ── OPTIONAL ANALYTICS ───────────────────────────────────────────────────────
 *   Register a global tracker before the app boots:
 *      window.__analyticsTrack = (payload) => {
 *        // send to your analytics service
 *        console.log('[Analytics]', payload);
 *      };
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef } from 'react';
import { useUpgradePrompt }  from '../../hooks/useUpgradePrompt';
import { useModal }          from '../../Context/ModalContext';
import { useSubscription }   from '../../Context/Subscription/SubscriptionContext';
import UpgradePromptModal    from './UpgradePromptModal';

const UpgradePromptController = () => {
  const { show, snooze, dismissForToday, onUpgrade } = useUpgradePrompt();
  const { openModal, closeModal }                     = useModal();
  const { openSubscription, subscriptionProgress } = useSubscription();

  const modalIdRef = useRef(null);

  useEffect(() => {
    if (show && !modalIdRef.current) {
      // Open the modal and store the id so we can close it programmatically
      const id = openModal(UpgradePromptModal, {
        subscriptionProgress,
        onUpgrade: () => {
          closeModal(id);
          modalIdRef.current = null;
          onUpgrade();
          openSubscription();   // opens the subscription/payment flow
        },
        onSnooze: () => {
          closeModal(id);
          modalIdRef.current = null;
          snooze();
        },
        onDismissToday: () => {
          closeModal(id);
          modalIdRef.current = null;
          dismissForToday();
        },
      });
      modalIdRef.current = id;
    }

    // If show becomes false while modal is open (e.g. user subscribed
    // in another tab), close it cleanly
    if (!show && modalIdRef.current) {
      closeModal(modalIdRef.current);
      modalIdRef.current = null;
    }
  }, [show, openModal, closeModal, onUpgrade, snooze, dismissForToday, openSubscription, subscriptionProgress]);

  // This component renders nothing itself — all UI is in the modal
  return null;
};

export default UpgradePromptController;