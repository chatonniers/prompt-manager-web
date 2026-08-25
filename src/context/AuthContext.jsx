import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);
const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const IDLE_EVENTS = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
const APP_BROADCAST_CHANNEL = 'app-broadcast';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState(false);
  const profileChannelRef = useRef(null);
  const appBroadcastRef = useRef(null);
  const pollRef = useRef(null);
  const userIdRef = useRef(null);
  const sessionRowRef = useRef(null);
  const sessionStartingRef = useRef(false);
  const idleTimerRef = useRef(null);

  const idleWatchingRef = useRef(false);

  function resetIdleTimer() {
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      sessionStorage.setItem('pm-auth-error', 'Your session expired after 2 hours of inactivity.');
      supabase.auth.signOut();
    }, IDLE_TIMEOUT_MS);
  }

  function startIdleWatcher() {
    if (idleWatchingRef.current) { resetIdleTimer(); return; }
    idleWatchingRef.current = true;
    resetIdleTimer();
    IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
  }

  function stopIdleWatcher() {
    idleWatchingRef.current = false;
    clearTimeout(idleTimerRef.current);
    IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer));
  }

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) setIsPasswordRecovery(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSession(session);
        setIsPasswordRecovery(true);
        return;
      }
      setSession(session);
      if (session) {
        loadProfile(session.user.id);
        if (event === 'SIGNED_IN') startSession(session.user.id);
      } else {
        endSession();
        stopIdleWatcher();
        setProfile(null);
        userIdRef.current = null;
        profileChannelRef.current?.unsubscribe();
        profileChannelRef.current = null;
        clearInterval(pollRef.current);
      }
    });

    const handleUnload = () => endSession();
    window.addEventListener('beforeunload', handleUnload);

    // Subscribe to global app broadcast (refresh notifications)
    appBroadcastRef.current = supabase
      .channel(APP_BROADCAST_CHANNEL)
      .on('broadcast', { event: 'refresh' }, () => setRefreshBanner(true))
      .subscribe();

    return () => {
      subscription.unsubscribe();
      profileChannelRef.current?.unsubscribe();
      appBroadcastRef.current?.unsubscribe();
      clearInterval(pollRef.current);
      stopIdleWatcher();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  async function startSession(userId) {
    if (sessionRowRef.current || sessionStartingRef.current) return;
    sessionStartingRef.current = true;
    const { data } = await supabase
      .from('sessions')
      .insert({ user_id: userId })
      .select('id')
      .single();
    if (data) sessionRowRef.current = data.id;
    sessionStartingRef.current = false;
  }

  async function endSession() {
    if (!sessionRowRef.current) return;
    const id = sessionRowRef.current;
    sessionRowRef.current = null;
    sessionStartingRef.current = false;
    const { data } = await supabase.from('sessions').select('started_at').eq('id', id).single();
    if (!data) return;
    const duration_s = Math.round((Date.now() - new Date(data.started_at).getTime()) / 1000);
    await supabase.from('sessions').update({ ended_at: new Date().toISOString(), duration_s }).eq('id', id);
  }

  async function checkBlocked(userId) {
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).single();
    if (data?.role === 'blocked') {
      await supabase.auth.signOut();
      return true;
    }
    return false;
  }

  async function loadProfile(userId) {
    userIdRef.current = userId;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data?.role === 'blocked') {
      await supabase.auth.signOut();
      return;
    }
    setProfile(data);
    subscribeToProfile(userId);
    startPolling(userId);
    startIdleWatcher();
  }

  function subscribeToProfile(userId) {
    if (profileChannelRef.current) return;
    profileChannelRef.current = supabase
      .channel(`profile-${userId}`)
      .on('broadcast', { event: 'kick' }, () => {
        sessionStorage.setItem('pm-auth-error', 'You have been disconnected by an administrator.');
        supabase.auth.signOut();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, payload => {
        const updated = payload.new;
        if (!updated || !updated.role) return;
        if (updated.role === 'blocked') {
          // Don't overwrite a kick message already set
          if (!sessionStorage.getItem('pm-auth-error')) {
            sessionStorage.setItem('pm-auth-error', 'Your account has been blocked. Contact your administrator.');
          }
          supabase.auth.signOut();
          return;
        }
        setProfile(updated);
      })
      .subscribe();
  }

  function startPolling(userId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (!userIdRef.current) return;
      await checkBlocked(userIdRef.current);
    }, 15000);
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (prof?.role === 'blocked') {
      await supabase.auth.signOut();
      sessionStorage.setItem('pm-auth-error', 'Your account has been blocked. Contact your administrator.');
      throw new Error('Your account has been blocked. Contact your administrator.');
    }
  }

  async function signUp(email, password, displayName, domainExpertise) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { display_name: displayName, domain_expertise: domainExpertise || [] } },
    });
    if (error) throw error;
  }

  async function signOut() {
    await endSession();
    await supabase.auth.signOut();
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setIsPasswordRecovery(false);
  }

  async function refreshProfile() {
    if (userIdRef.current) await loadProfile(userIdRef.current);
  }

  async function broadcastRefresh() {
    await appBroadcastRef.current?.send({
      type: 'broadcast',
      event: 'refresh',
      payload: {},
    });
  }

  const isAdmin = profile?.role === 'admin';
  const isEditor = profile?.role === 'editor' || isAdmin;
  const loading = session === undefined;

  return (
    <AuthContext.Provider value={{ session, profile, isAdmin, isEditor, loading, isPasswordRecovery, refreshBanner, setRefreshBanner, signIn, signUp, signOut, updatePassword, refreshProfile, broadcastRefresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
