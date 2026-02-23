import { ShieldCheck } from 'lucide-react';

/**
 * System notification: app uses only user's Supabase and user's Gemini.
 * No Lovable API, no key replacement, no hidden backend.
 */
export default function SystemNotification() {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b border-border text-[10px] text-muted-foreground"
      role="status"
      aria-label="Система использует только ваш Supabase и ваш Gemini API"
    >
      <ShieldCheck size={12} className="shrink-0 text-primary" />
      <span>
        Только ваш Supabase и ваш Gemini API. Lovable API не используется. Ключи не подменяются.
      </span>
    </div>
  );
}
