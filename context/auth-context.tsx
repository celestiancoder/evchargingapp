import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authService } from '../services/auth.service';

export type Profile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

type AuthContextType = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, full_name?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const data =await authService.getProfile(userId);
      setProfile(data);
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        const currentSession = await authService.getCurrentSession();
        setUser(currentUser);
        setSession(currentSession);
        if(currentSession?.user){
          await fetchProfile(currentSession.user.id);
        }
      } catch (err) {
        setUser(null);
        setSession(null);
        setProfile(null);
      } finally {
        setInitializing(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async(_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if(newSession?.user){
        await fetchProfile(newSession.user.id);
      }
      else{
        setProfile(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    await authService.signIn(email, password);
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const data = await authService.signUp(email, password,fullName);
    return { needsEmailConfirmation: !data.session };
  };

  const signOut = async () => {
    await authService.signOut();
  };

  const refreshProfile =async() => {
    if(user) await fetchProfile(user.id);
  }

  return (
    <AuthContext.Provider value={{ session, user,profile, initializing, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an AuthProvider');
  return ctx;
}