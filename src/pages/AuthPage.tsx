import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "login" | "register";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Authentication failed";
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);

  const modeTitle = useMemo(
    () => (mode === "login" ? "Sign in" : "Create account"),
    [mode],
  );

  useEffect(() => {
    let isMounted = true;

    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted) return;
      if (session) {
        navigate("/", { replace: true });
      }
    };

    void checkExistingSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        navigate("/", { replace: true });
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const validateEmail = (value: string): string | null => {
    if (!value.trim()) return "Email is required";
    if (!EMAIL_REGEX.test(value.trim())) return "Enter a valid email";
    return null;
  };

  const validatePassword = (value: string): string | null => {
    if (!value) return "Password is required";
    if (value.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return null;
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setInfoMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          navigate("/", { replace: true });
          return;
        }

        setInfoMessage("Account created. Check your email to confirm.");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      navigate("/", { replace: true });
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async () => {
    setErrorMessage("");
    setInfoMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const emailError = validateEmail(normalizedEmail);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    setIsSendingMagicLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setInfoMessage("Magic link sent. Check your email.");
    } catch (error: unknown) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h1 className="text-2xl font-semibold text-foreground">{modeTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your email and password to continue.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-md bg-muted p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setErrorMessage("");
              setInfoMessage("");
            }}
            className={`rounded px-3 py-2 text-sm transition ${
              mode === "login"
                ? "bg-background text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setErrorMessage("");
              setInfoMessage("");
            }}
            className={`rounded px-3 py-2 text-sm transition ${
              mode === "register"
                ? "bg-background text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
          <div className="space-y-1">
            <label htmlFor="auth-email" className="text-sm text-foreground">
              Email
            </label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              disabled={isSubmitting || isSendingMagicLink}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="auth-password" className="text-sm text-foreground">
              Password
            </label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="At least 6 characters"
              disabled={isSubmitting || isSendingMagicLink}
            />
          </div>

          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}

          {infoMessage ? (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {infoMessage}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting || isSendingMagicLink}
          >
            {isSubmitting
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={handleMagicLink}
          disabled={isSubmitting || isSendingMagicLink}
        >
          {isSendingMagicLink ? "Sending magic link..." : "Send magic link"}
        </Button>
      </div>
    </div>
  );
}
