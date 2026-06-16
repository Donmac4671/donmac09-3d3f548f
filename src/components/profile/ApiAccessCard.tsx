import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Key, Plus, Trash2, Copy, BookOpen, Webhook, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

interface TokenRow {
  id: string;
  label: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `dmh_live_${s}`;
}

function randomSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ApiAccessCard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  const [webhook, setWebhook] = useState<{ url: string; secret: string; is_active: boolean } | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [savingWebhook, setSavingWebhook] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: t }, { data: w }] = await Promise.all([
      supabase.from("api_tokens").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("api_webhooks").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setTokens((t as TokenRow[]) ?? []);
    if (w) {
      setWebhook(w as any);
      setWebhookUrl((w as any).url ?? "");
    } else {
      setWebhook(null);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [user?.id]);

  const createToken = async () => {
    if (!user) return;
    if (!label.trim()) {
      toast({ title: "Add a label", description: "Helps you remember where the token is used.", variant: "destructive" });
      return;
    }
    setCreating(true);
    const plain = randomToken();
    const hash = await sha256Hex(plain);
    const { error } = await supabase.from("api_tokens").insert({
      user_id: user.id,
      label: label.trim(),
      token_hash: hash,
      token_prefix: plain.slice(0, 16),
    });
    setCreating(false);
    if (error) {
      toast({ title: "Could not create token", description: error.message, variant: "destructive" });
      return;
    }
    setNewToken(plain);
    setLabel("");
    void load();
  };

  const revokeToken = async (id: string) => {
    if (!confirm("Revoke this token? Any site using it will stop working immediately.")) return;
    const { error } = await supabase.from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Token revoked" });
    void load();
  };

  const deleteToken = async (id: string) => {
    if (!confirm("Delete this token permanently?")) return;
    const { error } = await supabase.from("api_tokens").delete().eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    void load();
  };

  const saveWebhook = async () => {
    if (!user) return;
    const url = webhookUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return toast({ title: "Invalid URL", description: "Must start with http(s)://", variant: "destructive" });
    }
    setSavingWebhook(true);
    if (!url) {
      const { error } = await supabase.from("api_webhooks").delete().eq("user_id", user.id);
      setSavingWebhook(false);
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: "Webhook removed" });
      setWebhook(null);
      return;
    }
    const secret = webhook?.secret || randomSecret();
    const { error } = await supabase.from("api_webhooks").upsert({
      user_id: user.id,
      url,
      secret,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
    setSavingWebhook(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Webhook saved" });
    void load();
  };

  const rotateSecret = async () => {
    if (!user || !webhook) return;
    if (!confirm("Rotate the webhook secret? Any sites using the old secret will need to be updated.")) return;
    const { error } = await supabase.from("api_webhooks").update({ secret: randomSecret() }).eq("user_id", user.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Secret rotated" });
    void load();
  };

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: "Copied" });
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" /> API Access
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connect external websites so their orders are placed through your Donmac wallet.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/api-docs"><BookOpen className="w-4 h-4 mr-1" /> Documentation</Link>
        </Button>
      </div>

      {/* Tokens */}
      <div className="space-y-3">
        <p className="text-sm font-semibold">API Tokens</p>
        <div className="flex gap-2">
          <Input
            placeholder="Token label (e.g. mystore.com)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{ fontSize: 16 }}
          />
          <Button onClick={createToken} disabled={creating} className="gradient-primary border-0 shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Generate
          </Button>
        </div>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : tokens.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tokens yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{t.label}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{t.token_prefix}…</p>
                  <p className="text-[11px] text-muted-foreground">
                    Created {new Date(t.created_at).toLocaleDateString()}
                    {t.last_used_at ? ` • Last used ${new Date(t.last_used_at).toLocaleDateString()}` : " • Never used"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {t.revoked_at ? (
                    <Badge variant="destructive">Revoked</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => revokeToken(t.id)}>Revoke</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteToken(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Webhook */}
      <div className="space-y-3 pt-3 border-t border-border">
        <p className="text-sm font-semibold flex items-center gap-2">
          <Webhook className="w-4 h-4 text-primary" /> Order Status Webhook
        </p>
        <p className="text-xs text-muted-foreground">
          We'll POST order updates to this URL. Each request includes header <code className="bg-muted px-1 rounded">X-Donmac-Signature</code> (HMAC-SHA256 of the body using your secret).
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="https://yoursite.com/webhooks/donmac"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            style={{ fontSize: 16 }}
          />
          <Button onClick={saveWebhook} disabled={savingWebhook} className="gradient-primary border-0 shrink-0">
            Save
          </Button>
        </div>
        {webhook?.secret && (
          <div className="rounded-lg bg-muted/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground">Webhook secret</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1">{webhook.secret}</code>
              <Button size="sm" variant="ghost" onClick={() => copy(webhook.secret)}><Copy className="w-4 h-4" /></Button>
              <Button size="sm" variant="ghost" onClick={rotateSecret} title="Rotate"><RefreshCw className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* New token modal */}
      <Dialog open={!!newToken} onOpenChange={(o) => !o && setNewToken(null)}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your new API token</DialogTitle>
            <DialogDescription>Copy it now — it will not be shown again.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted p-3 break-all font-mono text-sm">{newToken}</div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="outline" onClick={() => newToken && copy(newToken)}>
              <Copy className="w-4 h-4 mr-1" /> Copy
            </Button>
            <Button className="flex-1 gradient-primary border-0" onClick={() => setNewToken(null)}>I've saved it</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
