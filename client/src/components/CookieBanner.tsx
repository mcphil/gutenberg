import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const CONSENT_KEY = "gl_cookie_consent";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't already accepted
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash immediately on load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
      role="dialog"
      aria-label="Cookie-Hinweis"
      aria-modal="false"
    >
      <div className="max-w-3xl mx-auto bg-card text-card-foreground border border-border rounded-xl shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Cookie className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 text-sm text-foreground/80 leading-relaxed">
          Diese Website verwendet ausschließlich technisch notwendige Cookies für die
          Authentifizierung. Es werden keine Tracking- oder Werbe-Cookies eingesetzt.{" "}
          <Link href="/datenschutz" className="text-primary hover:underline">
            Datenschutzerklärung
          </Link>
        </div>
        <Button
          size="sm"
          onClick={handleAccept}
          className="shrink-0 w-full sm:w-auto"
        >
          Verstanden
        </Button>
      </div>
    </div>
  );
}
