import React, {createContext, useState, useEffect, useContext} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase/supabase";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{error?: string}>;
    signUp: (email: string, password: string, username: string) => Promise<{error?: string}>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let initialized = false;

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            
            // Mark as initialized on first auth state change
            if (!initialized) {
                initialized = true;
                setLoading(false);
            }
        });

        return () => subscription?.unsubscribe();
    }, []);

    const signOut = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
        } catch (error) {
            throw error;
        } finally {
            setLoading(false);
        }
    };

    const signIn = async (email: string, password: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            setLoading(false);
            return { error: error?.message };
        } catch (e: any) {
            setLoading(false);
            return { error: e.message };
        }
    };

    const signUp = async (email: string, password: string, username: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                    },
                },
            });
            setLoading(false);
            return { error: error?.message };
        } catch (e: any) {
            setLoading(false);
            return { error: e.message };
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut, signIn, signUp }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};