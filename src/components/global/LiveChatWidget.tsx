import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Paperclip, Bot, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import ChatMedia from "@/components/chat/ChatMedia";

type AiMessage = { role: "user" | "assistant"; content: string };

function AiChatTab() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: AiMessage = { role: "user", content: input.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);

    let assistantSoFar = "";
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });

      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Something went wrong" }));
        setMessages((prev) => [...prev, { role: "assistant", content: err.error || "Sorry, something went wrong. Please try again." }]);
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "" || !line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center mt-6 space-y-2">
            <Bot className="w-10 h-10 mx-auto text-primary/60" />
            <p className="text-muted-foreground text-xs">Hi! I'm Donmac AI Assistant. Ask me anything about our services!</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-2">
              {["How do I buy data?", "How to deposit via MoMo?"].map((q) => (
                <button key={q} onClick={() => { setInput(q); }} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
              m.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.content}</p>
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
              <span className="text-sm text-muted-foreground animate-pulse">Typing...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t border-border flex gap-1.5 items-center">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask me anything..."
          className="text-sm h-9"
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={loading}
        />
        <Button size="icon" className="shrink-0 h-9 w-9" onClick={send} disabled={loading || !input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}

function LiveChatTab() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return;
    fetchMessages();
    const channel = supabase
      .channel("user-chat-widget")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${user.id}` }, (payload) => {
        setMessages((prev) => [...prev, payload.new]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old?.id));
      })
      .subscribe();

    const typingCh = supabase.channel(`chat-typing-${user.id}`, { config: { broadcast: { self: false } } });
    typingCh.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload?.payload?.role === "admin") {
        setAdminTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 2500);
      }
    }).subscribe();
    typingChannelRef.current = typingCh;

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(typingCh);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, adminTyping]);

  const fetchMessages = async () => {
    if (!user) return;
    const { data } = await supabase.from("chat_messages").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { role: "user" } });
  };

  const sendMessage = async (mediaUrl?: string) => {
    if ((!newMsg.trim() && !mediaUrl) || !user || sending) return;
    setSending(true);
    await supabase.from("chat_messages").insert({ user_id: user.id, message: newMsg.trim() || (mediaUrl ? "📎 Media" : ""), sender_role: "user", media_url: mediaUrl || null });
    setNewMsg("");
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (!error) {
      await sendMessage(path);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-muted-foreground text-xs mt-8">Send us a message and we'll reply shortly.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
              m.sender_role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
            }`}>
              {m.media_url && <ChatMedia value={m.media_url} />}
              {m.message && m.message !== "📎 Media" && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.message}</p>}
              <p className={`text-[10px] mt-1 ${m.sender_role === "user" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                {format(new Date(m.created_at), "h:mm a")}
              </p>
            </div>
          </div>
        ))}
        {adminTyping && (
          <div className="flex justify-start">
            <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
              <span className="text-xs text-muted-foreground animate-pulse">Support is typing…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="p-2 border-t border-border flex gap-1.5 items-center">
        <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" className="hidden" onChange={handleFileUpload} />
        <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Paperclip className="w-4 h-4" />
        </Button>
        <Input value={newMsg} onChange={(e) => { setNewMsg(e.target.value); emitTyping(); }} placeholder={uploading ? "Uploading..." : "Type a message..."} className="text-sm h-9" onKeyDown={(e) => e.key === "Enter" && sendMessage()} disabled={uploading} />
        <Button size="icon" className="shrink-0 h-9 w-9" onClick={() => sendMessage()} disabled={sending || uploading || !newMsg.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </>
  );
}

export default function LiveChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"ai" | "live">("ai");
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("user-chat-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `user_id=eq.${user.id}` }, (payload: any) => {
        if (!open && payload.new.sender_role === "admin") setUnread((u) => u + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  if (!user) return null;

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} className="fixed bottom-4 left-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity">
          <MessageCircle className="w-6 h-6" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{unread}</span>
          )}
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 left-4 z-50 w-80 sm:w-96 h-[28rem] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {tab === "ai" ? <Bot className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
              <span className="font-semibold text-sm">{tab === "ai" ? "AI Assistant" : "Live Chat"}</span>
            </div>
            <button onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-border">
            <button onClick={() => setTab("ai")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${tab === "ai" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Bot className="w-3.5 h-3.5" /> AI Assistant
            </button>
            <button onClick={() => setTab("live")} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${tab === "live" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Users className="w-3.5 h-3.5" /> Live Chat
            </button>
          </div>

          {/* Content */}
          {tab === "ai" ? <AiChatTab /> : <LiveChatTab />}
        </div>
      )}
    </>
  );
}
