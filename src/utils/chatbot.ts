import { supabase } from '../supabase/supabase';

const SUPABASE_URL = "https://tetgyhnqikauxjlrseiz.supabase.co";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

export type ChatCard = {
  type: "product" | "vehicle";
  id: string;
  title: string;
  subtitle?: string | null;
  price?: number | null;
  image?: string | null;
  target: { screen: string; params?: Record<string, any> };
};

// The catalogue snapshot we send to the edge function so the model can answer
// with current data and emit structured cards. Built from data the app has
// already fetched (and which respects RLS / what the user can see).
export type ChatbotContext = {
  products?: Array<{
    id: string;
    title: string;
    brand?: string | null;
    price?: number | null;
    images?: any;
    sku?: string | null;
  }>;
  vehicles?: Array<{
    id: string;
    make: string;
    model: string;
    year: number;
    year_to?: number | null;
  }>;
  categories?: Array<{ id: number; name: string }>;
};

/**
 * Builds a lightweight catalogue snapshot (products, categories, vehicles)
 * straight from the database. Used to give the chatbot context + ids it can
 * turn into tappable cards. Failures return null and the edge function
 * falls back to its own (service-role) catalogue read.
 */
export async function buildClientContext(): Promise<ChatbotContext | null> {
  try {
    const [products, categories, vehicles] = await Promise.all([
      supabase
        .from('products')
        .select('id, title, brand, price, images, sku')
        .order('created_at', { ascending: false })
        .limit(80),
      supabase.from('categories').select('id, name').order('name', { ascending: true }).limit(50),
      supabase
        .from('vehicles')
        .select('id, make, model, year, year_to')
        .order('make', { ascending: true })
        .limit(60),
    ]);
    return {
      products: (products.data as any[]) || [],
      categories: (categories.data as any[]) || [],
      vehicles: (vehicles.data as any[]) || [],
    };
  } catch (e) {
    console.warn('[chatbot] Failed to build client context', e);
    return null;
  }
}

export async function sendChatMessage(
  messages: ChatMessage[],
  opts: {
    model?: string | null;
    systemPrompt?: string | null;
    storeName?: string | null;
    context?: ChatbotContext | null;
  },
): Promise<{ reply: string; cards: ChatCard[] }> {
  const anonKey = (supabase as any).supabaseKey as string;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/chatbot`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      model: opts.model || null,
      systemPrompt: opts.systemPrompt || null,
      storeName: opts.storeName || null,
      storeUrl: 'https://autohelpgh.com',
      context: opts.context || null,
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = j?.error || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(detail || `Chatbot request failed (${res.status}).`);
  }

  const data = await res.json();
  if (!data?.reply) throw new Error('No response from the assistant.');
  return { reply: data.reply as string, cards: (data.cards as ChatCard[]) || [] };
}