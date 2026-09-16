import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import { getCurrentSession } from '../supabase/auth';
import { applyPendingProfileIfNeeded } from '../pendingProfile';
import { applyCloudPaletteIfNeeded } from '../paletteSync';

interface AuthState {
  session: Session | null;
  initialized: boolean;
}

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  initialized: false,
}));

getCurrentSession()
  .then((session) => {
    useAuthStore.setState({ session, initialized: true });
    void applyPendingProfileIfNeeded(session);
    void applyCloudPaletteIfNeeded(session);
  })
  .catch(() => useAuthStore.setState({ initialized: true }));

supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session });
  void applyPendingProfileIfNeeded(session);
  void applyCloudPaletteIfNeeded(session);
});
