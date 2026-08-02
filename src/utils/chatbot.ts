import { supabase } from '../supabase/supabase';

const SUPABASE_URL = "https://tetgyhnqikauxjlrseiz.supabase.co";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// Calls the `chatbot` edge function (which proxies OpenRouter and reads the
// store catalogue server-side). The OpenRouter key is kept in an edge-function
// secret, never exposed here.
export async function sendChatMessage(
  messages: ChatMessage[],
  opts: { model?: string | null; systemPrompt?: string | null; storeName?: string | null },
): Promise<string> {
  const anonKey = (supabase as any).supabaseKey as string;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: opts.model || null,
      systemPrompt: opts.systemPrompt || null,
      storeName: opts.storeName || null,
      storeUrl: "https://autohelpgh.com",
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `Chatbot request failed (${res.status}).`);
  }

  const data = await res.json();
  if (!data?.reply) throw new Error("No response from the assistant.");
  return data.reply as string;
}