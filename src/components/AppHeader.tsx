import { CheckCircle2, Download, Loader2, LogOut, Save } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { exportScreenplayDocx } from "@/lib/export-docx";
import { useProjectStore } from "@/stores/useProjectStore";

export default function AppHeader() {
  const { title, lastSaved, editorContent } = useProjectStore();
  const [exporting, setExporting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const displayTitle = title || "Untitled";

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScreenplayDocx(displayTitle, editorContent);
      toast({
        title: "Export complete",
        description: "The .docx file was downloaded.",
      });
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : "Failed to export screenplay.";
      toast({
        title: "Export failed",
        description,
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        toast({
          title: "Logout failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      navigate("/auth", { replace: true });
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : "Unexpected logout error.";
      toast({
        title: "Logout failed",
        description,
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-border bg-card/50 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-serif font-bold text-primary tracking-wide">kscript AI</h1>
        <span className="text-xs text-muted-foreground">-</span>
        <span className="text-sm text-foreground truncate max-w-64">{displayTitle}</span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleExport}
          disabled={exporting || signingOut}
        >
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Download .docx
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={handleLogout}
          disabled={exporting || signingOut}
        >
          {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
          Logout
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastSaved ? (
            <>
              <CheckCircle2 size={14} className="text-success" />
              <span>Saved</span>
            </>
          ) : (
            <>
              <Save size={14} />
              <span>Autosaving</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
