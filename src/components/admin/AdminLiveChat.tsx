import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Send, Search, MessageCircle, Paperclip, Trash2 } from "lucide-react";
import { format } from "date-fns";
import ChatMedia from "@/components/chat/ChatMedia";

interface ChatThread {
  user_id: string;
  full_name: string;
  email: string;
  last_message: string;
  last_at: string;
  unread: number;
}

export default function AdminLiveChat() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<{ user_id: string; full_name: string; email: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);
  const lastTypingSentRef = useRef<number>(0);

  useEffect(() => {
    fetchThreads();

    const channel = supabase
      .channel("admin-chat")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        fetchThreads();
        if (selectedUser) fetchMessages(selectedUser);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedUser]);

  // Typing indicator broadcast channel scoped to the selected user
  useEffect(() => {
    if (!selectedUser) return;
    const ch = supabase.channel(`chat-typing-${selectedUser}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "typing" }, (payload: any) => {
      if (payload?.payload?.role === "user") {
        setUserTyping(true);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setUserTyping(false), 2500);
      }
    }).subscribe();
    typingChannelRef.current = ch;
    return () => {
      clearTimeout(typingTimeoutRef.current);
      setUserTyping(false);
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
    };
  }, [selectedUser]);

  const emitTyping = () => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;
    typingChannelRef.current?.send({ type: "broadcast", event: "typing", payload: { role: "admin" } });
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, userTyping]);

  const fetchThreads = async () => {
    const { data: allMessages } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (!allMessages) return;

    const userIds = [...new Set(allMessages.map((m) => m.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", userIds);

    const profileMap = new Map(profiles?.map((p) => [p.user_id, p]) || []);

    const threadMap = new Map<string, ChatThread>();
    for (const msg of allMessages) {
      if (!threadMap.has(msg.user_id)) {
        const profile = profileMap.get(msg.user_id);
        threadMap.set(msg.user_id, {
          user_id: msg.user_id,
          full_name: profile?.full_name || "Unknown",
          email: profile?.email || "",
          last_message: msg.message,
          last_at: msg.created_at,
          unread: 0,
        });
      }
      if (msg.sender_role === "user" && !msg.is_read) {
        const t = threadMap.get(msg.user_id)!;
        t.unread++;
      }
    }

    setThreads(Array.from(threadMap.values()).sort((a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()));
  };

  const fetchMessages = async (userId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);

    await supabase
      .from("chat_messages")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("sender_role", "user")
      .eq("is_read", false);
  };

  const selectThread = (userId: string) => {
    setSelectedUser(userId);
    fetchMessages(userId);
  };

  const sendReply = async (mediaUrl?: string) => {
    if ((!newMsg.trim() && !mediaUrl) || !selectedUser || sending) return;
    setSending(true);
    await supabase.from("chat_messages").insert({
      user_id: selectedUser,
      message: newMsg.trim() || (mediaUrl ? "📎 Media" : ""),
      sender_role: "admin",
      media_url: mediaUrl || null,
    });
    setNewMsg("");
    setSending(false);
    fetchMessages(selectedUser);
    fetchThreads();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `admin/${selectedUser}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("chat-media").upload(path, file);
    if (!error) {
      // Store the storage path; signed URLs are generated on render.
      await sendReply(path);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const isImage = (url: string) => /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(url);

  const filteredThreads = threads.filter(
    (t) =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  // Search all users when query doesn't match existing threads
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setUserSearchResults([]); return; }
    const threadIds = new Set(threads.map((t) => t.user_id));
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
        .limit(20);
      if (cancelled) return;
      setUserSearchResults((data || []).filter((p) => !threadIds.has(p.user_id)));
      setSearching(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, threads]);

  const startChatWithUser = (u: { user_id: string; full_name: string; email: string }) => {
    // Optimistically add a thread entry so header renders
    setThreads((prev) => {
      if (prev.some((t) => t.user_id === u.user_id)) return prev;
      return [{
        user_id: u.user_id,
        full_name: u.full_name || "Unknown",
        email: u.email || "",
        last_message: "",
        last_at: new Date().toISOString(),
        unread: 0,
      }, ...prev];
    });
    setUserSearchResults([]);
    setSearch("");
    selectThread(u.user_id);
  };

  const selectedProfile = threads.find((t) => t.user_id === selectedUser);

  return (
    <div className="flex h-[500px] border border-border rounded-xl overflow-hidden bg-card">
      {/* Thread list */}
      <div className="w-1/3 border-r border-border flex flex-col">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 text-sm h-9" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredThreads.length === 0 && userSearchResults.length === 0 && (
            <p className="text-center text-muted-foreground text-xs mt-8">
              {search.trim().length >= 2 ? (searching ? "Searching…" : "No users found") : "No conversations yet"}
            </p>
          )}
          {filteredThreads.map((t) => (
            <button
              key={t.user_id}
              onClick={() => selectThread(t.user_id)}
              className={`w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/50 transition-colors ${
                selectedUser === t.user_id ? "bg-muted" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate">{t.full_name}</span>
                {t.unread > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px] justify-center">
                    {t.unread}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{t.last_message}</p>
              <p className="text-[10px] text-muted-foreground">{format(new Date(t.last_at), "MMM d, h:mm a")}</p>
            </button>
          ))}
          {userSearchResults.length > 0 && (
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground bg-muted/40 border-b border-border">
              Start new chat
            </div>
          )}
          {userSearchResults.map((u) => (
            <button
              key={u.user_id}
              onClick={() => startChatWithUser(u)}
              className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <MessageCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="font-medium text-sm truncate">{u.full_name || "Unknown"}</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mt-0.5 ml-5">{u.email}</p>
            </button>
          ))}
        </div>
      </div>


      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedUser ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <p className="font-semibold text-sm">{selectedProfile?.full_name}</p>
              <p className="text-xs text-muted-foreground">{selectedProfile?.email}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => (
                <div key={m.id} className={`group flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"} items-end gap-1`}>
                  {m.sender_role === "admin" && (
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this message?")) return;
                        await supabase.from("chat_messages").delete().eq("id", m.id);
                        setMessages((prev) => prev.filter((x) => x.id !== m.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-xl text-sm ${
                      m.sender_role === "admin"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.media_url && <ChatMedia value={m.media_url} />}
                    {m.message && m.message !== "📎 Media" && (
                      <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.message}</p>
                    )}
                    <p className={`text-[10px] mt-1 ${m.sender_role === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {format(new Date(m.created_at), "h:mm a")}
                    </p>
                  </div>
                  {m.sender_role !== "admin" && (
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this message?")) return;
                        await supabase.from("chat_messages").delete().eq("id", m.id);
                        setMessages((prev) => prev.filter((x) => x.id !== m.id));
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
                      aria-label="Delete message"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {userTyping && (
                <div className="flex justify-start">
                  <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm">
                    <span className="text-xs text-muted-foreground animate-pulse">User is typing…</span>
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
              <Input
                value={newMsg}
                onChange={(e) => { setNewMsg(e.target.value); emitTyping(); }}
                placeholder={uploading ? "Uploading..." : "Type a reply..."}
                className="text-sm h-9"
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                disabled={uploading}
              />
              <Button size="icon" className="shrink-0 h-9 w-9" onClick={() => sendReply()} disabled={sending || uploading || !newMsg.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
