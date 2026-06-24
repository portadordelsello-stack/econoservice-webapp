import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signOut as firebaseSignOut, 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Role, UserProfile } from "../types";

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  authError: string | null;
  setAuthError: (error: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const isGlobalAdmin = firebaseUser.email?.toLowerCase() === "portadordelsello@gmail.com";

          if (isGlobalAdmin) {
            const adminProfile: UserProfile = {
              uid: firebaseUser.uid,
              nombre: firebaseUser.displayName || "Administrador Global",
              email: firebaseUser.email || "portadordelsello@gmail.com",
              rol: "superadmin",
              activo: true,
              createdAt: new Date(),
            };
            await setDoc(userDocRef, {
              ...adminProfile,
              activo: true,
              rol: "superadmin"
            }, { merge: true });
            setProfile(adminProfile);
            setLoading(false);
          } else {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const existing = userDoc.data() as UserProfile;
              if (!existing.activo) {
                setAuthError("espera que el administrador del sistema active tu cuenta, intenta mas tarde");
                setUser(null);
                setProfile(null);
                await firebaseSignOut(auth);
              } else {
                setProfile(existing);
              }
            } else {
              // Create default profile for new user - default to inactive
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                nombre: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Usuario",
                email: firebaseUser.email || "",
                rol: "tecnico",
                activo: false,
                createdAt: new Date(),
              };
              await setDoc(userDocRef, {
                ...newProfile,
                createdAt: serverTimestamp()
              });
              setAuthError("espera que el administrador del sistema active tu cuenta, intenta mas tarde");
              setUser(null);
              setProfile(null);
              await firebaseSignOut(auth);
            }
            setLoading(false);
          }
        } catch (err: any) {
          console.error("Error fetching user profile:", err);
          setAuthError(err.message || "Error al procesar el perfil de usuario.");
          setProfile(null);
          setLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Enforce select_account to make testing multiple accounts easier
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setLoading(false);
      console.error("Error logging in with Google:", error);
      setAuthError(error.message || "Error al autenticar con Google.");
      throw error;
    }
  };

  const signOut = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut, authError, setAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
