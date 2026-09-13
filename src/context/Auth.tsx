import React, {createContext, useState, useEffect, useContext} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, getRedirectUrl } from "../supabase/supabase";
import * as WebBrowser from "expo-web-browser";

// Tells expo-web-browser to close the in-app auth session once the redirect
// returns to the app. Without this the Custom Tab / SFSafariViewController can
// stay open on a spinner and the flow never completes.
WebBrowser.maybeCompleteAuthSession();

// Guards against exchanging the OAuth code twice (it can arrive both via the
// openAuthSessionAsync result and via a Linking deep-link, e.g. on cold start).
let oauthCodeHandled = false;

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signOut: () => Promise<void>;
    signIn: (email: string, password: string) => Promise<{error?: string}>;
    signUp: (email: string, password: string, username: string) => Promise<{error?: string}>;
    deleteAccount: () => Promise<{error?: string}>;
    signInWithProvider: (provider: "google" | "apple") => Promise<{error?: string}>;
    resetPassword: (email: string) => Promise<{error?: string}>;
    updatePassword: (password: string) => Promise<{error?: string}>;
    recoveryMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [recoveryMode, setRecoveryMode] = useState(false);

    // Process an OAuth / password-reset redirect URL and establish a session.
    // Handles THREE flows:
    //  - PKCE: URL contains `?code=...` → exchangeCodeForSession(code)
    //  - Implicit: URL contains `#access_token=...&refresh_token=...` (or query)
    //    → setSession({ access_token, refresh_token })
    //  - Password reset: URL contains `?token_hash=...&type=recovery` (the link
    //    from the reset email redirected back to the app scheme) → verifyOtp.
    //    We also force `recoveryMode` on so the app shows the "set new password"
    //    screen instead of silently logging the user in.
    // Mirrors the proven CHAWP approach so the app reliably returns to a logged-in
    // state after the user selects an account. Returns { error } on failure.
    const handleOAuthRedirect = React.useCallback(async (url: string): Promise<{ error?: string }> => {
        if (!url) return {};
        if (oauthCodeHandled) return {};
        try {
            // Parse params from either the hash or the query string.
            let params: URLSearchParams | null = null;
            if (url.includes("#")) {
                params = new URLSearchParams(url.split("#")[1]);
            } else if (url.includes("?")) {
                params = new URLSearchParams(url.split("?")[1]);
            }

            // --- Password reset / recovery flow ---
            const type = params?.get("type");
            const tokenHash = params?.get("token_hash");
            if (type === "recovery" && tokenHash) {
                // Surface recovery mode immediately so the UI shows the
                // "set new password" screen rather than the main app.
                setRecoveryMode(true);
                oauthCodeHandled = true;
                const { error } = await supabase.auth.verifyOtp({
                    token_hash: tokenHash,
                    type: "recovery",
                });
                if (error) {
                    oauthCodeHandled = false;
                    setRecoveryMode(false);
                    return { error: error.message };
                }
                return {};
            }

            // --- PKCE code flow ---
            if (url.includes("code=")) {
                const code = url.split("code=")[1]?.split("&")[0];
                if (!code) return { error: "Missing authorization code in redirect." };
                oauthCodeHandled = true;
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    oauthCodeHandled = false; // allow a retry on the alternate path
                    return { error: error.message };
                }
                return {};
            }

            // --- Implicit token flow (tokens in hash or query) ---
            if (params) {
                const accessToken = params.get("access_token");
                const refreshToken = params.get("refresh_token");
                if (accessToken && refreshToken) {
                    // A recovery deep link can also arrive as access/refresh tokens
                    // with type=recovery — make sure we still show the reset screen.
                    if (type === "recovery") setRecoveryMode(true);
                    oauthCodeHandled = true;
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });
                    if (error) {
                        oauthCodeHandled = false;
                        setRecoveryMode(false);
                        return { error: error.message };
                    }
                    return {};
                }
            }

            return {};
        } catch (e: any) {
            oauthCodeHandled = false; // allow a retry on the alternate path
            return { error: e?.message ?? "OAuth redirect handling failed." };
        }
    }, []);

    useEffect(() => {
        let initialized = false;

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);

            // When the user opens a password-reset link, Supabase establishes a
            // short-lived "recovery" session. Surface that so the app can show the
            // "set new password" screen instead of dropping the user straight in.
            if (_event === "PASSWORD_RECOVERY") {
                setRecoveryMode(true);
            }

            // Mark as initialized on first auth state change
            if (!initialized) {
                initialized = true;
                setLoading(false);
            }
        });

        // Fallback for cold-start / external-browser redirects.
        let linkingSubscription: { remove: () => void } | undefined;
        let mounted = true;
        (async () => {
            const { Linking } = await import("react-native");
            const initialUrl = await Linking.getInitialURL();
            if (mounted && initialUrl) {
                await handleOAuthRedirect(initialUrl);
            }
            linkingSubscription = Linking.addEventListener("url", (event) => {
                void handleOAuthRedirect(event.url).then(() => {
                    // Required so the in-app browser fully closes and the app
                    // regains control (otherwise the Google screen hangs).
                    // expo-web-browser handles the actual dismissal; we only
                    // flag the session as complete here.
                    try {
                        WebBrowser.maybeCompleteAuthSession();
                    } catch { /* no-op */ }
                });
            });
        })();

        return () => {
            mounted = false;
            subscription?.unsubscribe();
            linkingSubscription?.remove();
        };
    }, [handleOAuthRedirect]);

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

    const deleteAccount = async (): Promise<{ error?: string }> => {
      try {
        const { error } = await supabase.rpc('delete_user_account');
        if (error) return { error: error.message };
        // The auth user is now gone; attempt to clear local session state.
        // signOut may fail because the auth user no longer exists, so we
        // swallow any error and force-clear the local state instead.
        try {
          await supabase.auth.signOut();
        } catch {
          setSession(null);
          setUser(null);
        }
        return {};
      } catch (e: any) {
        return { error: e?.message ?? 'Failed to delete account.' };
      }
    };

    const signInWithProvider = async (provider: "google" | "apple") => {
        try {
            // Start a fresh OAuth attempt: allow the code to be exchanged again.
            oauthCodeHandled = false;
            const redirectTo = getRedirectUrl();
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo,
                    // We open the URL ourselves so we can capture the redirect
                    // result directly (mirrors the proven ExpressMart approach).
                    skipBrowserRedirect: true,
                    ...(provider === "google"
                        ? { queryParams: { prompt: "select_account" } }
                        : {}),
                },
            });
            if (error) {
                return { error: error.message };
            }
            if (!data?.url) {
                return { error: "Could not start provider sign-in." };
            }

            // Open the native in-app browser (Custom Tabs / SFSafariViewController).
            // When the user selects an account, Google redirects back to
            // `redirectTo` and openAuthSessionAsync resolves with the redirect
            // URL in `result.url`. expo-web-browser then dismisses the browser
            // automatically and hands control back to the app.
            const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

            if (result.type === "success" && result.url) {
                const { error: exchangeError } = await handleOAuthRedirect(result.url);
                if (exchangeError) return { error: exchangeError };
            } else if (result.type === "cancel" || result.type === "dismiss") {
                return { error: "Sign-in cancelled." };
            } else {
                return { error: `OAuth flow failed: ${result.type}` };
            }

            // The exchange sets the session. Poll briefly for it to propagate
            // instead of checking instantly, which can race ahead of the exchange.
            for (let i = 0; i < 20; i++) {
                const { data: sessionData } = await supabase.auth.getSession();
                if (sessionData.session) return {};
                await new Promise((res) => setTimeout(res, 150));
            }
            return { error: "Sign-in could not be completed. Please try again." };
        } catch (e: any) {
            return { error: e.message };
        }
    };

    const resetPassword = async (email: string) => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: getRedirectUrl(),
            });
            setLoading(false);
            return { error: error?.message };
        } catch (e: any) {
            setLoading(false);
            return { error: e.message };
        }
    };

    const updatePassword = async (password: string) => {
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) return { error: error.message };
            setRecoveryMode(false);
            return {};
        } catch (e: any) {
            return { error: e.message };
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, loading, signOut, signIn, signUp, signInWithProvider, resetPassword, updatePassword, deleteAccount, recoveryMode }}>
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