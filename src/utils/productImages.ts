import { supabase } from '../supabase/supabase';

const PRODUCT_IMAGES_BUCKET = 'product-images';
const PUBLIC_STORAGE_PREFIX = /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/product-images\//;

export function normalizeProductImagePath(path: string): string {
  return path.replace(PUBLIC_STORAGE_PREFIX, '').trim();
}

export function toPublicProductImageUrl(path: string): string {
  const normalized = normalizeProductImagePath(path);
  if (/^https?:\/\//.test(normalized)) return normalized;
  const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(normalized);
  return data.publicUrl;
}

export function getProductImageUri(images: unknown): string | null {
  if (!Array.isArray(images) || !images.length) return null;
  const first = images[0];
  if (!first || typeof first !== 'object' || !('path' in first)) return null;
  const path = (first as { path?: unknown }).path;
  if (typeof path !== 'string' || !path.trim()) return null;
  return toPublicProductImageUrl(path);
}

