import { Image } from 'react-native';

export type ImageSize = { width: number; height: number };

/** `null` records a measurement that failed, so it is never retried. */
const cache = new Map<string, ImageSize | null>();

/**
 * Returns an already measured size, or undefined when the uri has not been
 * measured yet. Lets a screen seed state without an extra async hop.
 */
export function peekImageSize(uri: string): ImageSize | undefined {
  return cache.get(uri) ?? undefined;
}

/** True once a uri has been measured (successfully or not). */
export function hasMeasuredImage(uri: string): boolean {
  return cache.has(uri);
}

/**
 * Measures an image's intrinsic size, memoised per uri.
 *
 * Products only persist an image path, so a masonry layout has to learn each
 * image's aspect ratio at runtime before it can size the card. Sizes are
 * cached for the life of the app, so remounting the feed costs nothing.
 */
export function loadImageSize(uri: string): Promise<ImageSize | null> {
  const cached = cache.get(uri);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => {
        const size: ImageSize | null = width > 0 && height > 0 ? { width, height } : null;
        cache.set(uri, size);
        resolve(size);
      },
      () => {
        cache.set(uri, null);
        resolve(null);
      },
    );
  });
}
