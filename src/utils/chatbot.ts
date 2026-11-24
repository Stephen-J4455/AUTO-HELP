import { supabase } from '../supabase/supabase';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export const CANVAS_SECTIONS = ['part', 'photos', 'fitment', 'answer'] as const;
export type CanvasSection = typeof CANVAS_SECTIONS[number];

export type Fitment = {
  make: string;
  model: string;
  trim?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
};

export type CanvasProduct = {
  id: string;
  title: string;
  sku: string;
  brand: string;
  price: number | null;
  images: string[];
  fitments: Fitment[];
};

export type FlowBlock = { kind: 'text'; text: string } | { kind: Exclude<CanvasSection, 'answer'>; productId: string };
export type Canvas = { order: CanvasSection[]; products: CanvasProduct[]; flow?: FlowBlock[] };

export async function sendChatMessage(messages: ChatMessage[], workspace: Canvas, selectedProductId?: string, webSearch = false) {
  const { data, error } = await supabase.functions.invoke<{ reply: string; canvas?: Canvas }>('chatbot', {
    body: {
      canvas: true,
      webSearch,
      presentation: 'inline',
      messages: messages.slice(-16).map(({ role, content }) => ({ role, content })),
      workspace: {
        order: workspace.order,
        productIds: [...new Set([selectedProductId, ...workspace.products.map(({ id }) => id)])].filter(Boolean),
        selectedProductId,
      },
    },
  });

  if (error) {
    const response = error.context;
    const detail = response instanceof Response ? await response.json().catch(() => null) : null;
    throw new Error(detail?.error || 'Autobot couldn’t complete that request. Try again.');
  }
  if (!data?.reply) throw new Error('No response from Autobot.');
  return data;
}

export function replyFlow(reply: string, canvas?: Canvas): FlowBlock[] {
  if (canvas?.flow) return canvas.flow;
  const text: FlowBlock = { kind: 'text', text: reply };
  if (!canvas?.products.length) return [text];
  const blocks: FlowBlock[] = [];
  const product = canvas.products[0];
  for (const kind of canvas.order) {
    if (kind === 'answer') blocks.push(text);
    else if (kind === 'part') blocks.push(...canvas.products.map(({ id }) => ({ kind, productId: id })));
    else if (kind === 'photos' ? product.images.length : product.fitments.length) blocks.push({ kind, productId: product.id });
  }
  return blocks;
}
