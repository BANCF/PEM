"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

export type Role = "ADMIN" | "BGH" | "TTCM" | "TPCM" | "TEACHER" | "SUPER_ADMIN";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  departmentId?: string;
  department?: string;
}

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  actualProfile: UserProfile | null; // For Super Admin impersonation tracking
  loading: boolean;
  setImpersonatedUid: (uid: string) => void;
  clearImpersonatedUid: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  actualProfile: null,
  loading: true,
  setImpersonatedUid: () => {},
  clearImpersonatedUid: () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [actualProfile, setActualProfile] = useState<UserProfile | null>(null);
  const [impersonatedUid, setImpersonatedUidState] = useState<string | null>(null);

  useEffect(() => {
    // If we have an impersonatedUid, fetch that user's profile and use it as 'profile'
    const fetchImpersonated = async () => {
      if (impersonatedUid && actualProfile?.role === "SUPER_ADMIN") {
        try {
          const impDoc = await getDoc(doc(db, "users", impersonatedUid));
          if (impDoc.exists()) {
            setProfile({ id: impDoc.id, ...impDoc.data() } as UserProfile);
          }
        } catch (error) {
          console.error("Error impersonating:", error);
        }
      } else {
        setProfile(actualProfile);
      }
    };
    fetchImpersonated();
  }, [impersonatedUid, actualProfile]);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
      
      if (currentUser) {
        unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (userDoc) => {
          if (userDoc.exists()) {
            const p = { id: currentUser.uid, ...userDoc.data() } as UserProfile;
            setActualProfile(p);
          } else {
            setActualProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error watching user profile:", error);
          setActualProfile(null);
          setLoading(false);
        });
      } else {
        setActualProfile(null);
        setImpersonatedUidState(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
    };
  }, []);

  const setImpersonatedUid = (uid: string) => {
    if (actualProfile?.role === "SUPER_ADMIN") {
      setImpersonatedUidState(uid);
    }
  };

  const clearImpersonatedUid = () => {
    setImpersonatedUidState(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, actualProfile, loading, setImpersonatedUid, clearImpersonatedUid }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
