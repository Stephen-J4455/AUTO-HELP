import React from 'react';
import { View, StyleSheet } from 'react-native';

export type MasonryItem = {
  /** Intrinsic pixel size of the card's image, when known. */
  imageSize?: { width: number; height: number } | null;
  /**
   * Full card height including any text block. Takes precedence over
   * `imageSize` when present; omit it and the grid derives a height from the
   * image ratio instead.
   */
  height?: number;
};

type Props<T extends MasonryItem> = {
  data: T[];
  columns: number;
  gap: number;
  /** Card width for a column, used to convert image ratios into heights. */
  columnWidth: number;
  /** Fallback height for cards whose image size has not loaded yet. */
  estimatedHeight?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  ListEmptyComponent?: React.ReactNode;
  style?: any;
};

/**
 * Distributes items into `columns` vertical columns, always appending the next
 * item to whichever column is currently shortest. That balances the columns by
 * real measured card height, so cards with varying image aspect ratios pack
 * tightly instead of leaving the ragged gaps a plain flex-wrap grid produces.
 *
 * Cards keep their natural height, so a product image renders at its full
 * intrinsic aspect ratio rather than being cropped into a fixed box.
 */
export default function MasonryGrid<T extends MasonryItem>({
  data,
  columns,
  gap,
  columnWidth,
  estimatedHeight = 220,
  renderItem,
  ListEmptyComponent,
  style,
}: Props<T>) {
  const cols = Math.max(1, Math.min(columns, data.length || 1));

  const buckets = React.useMemo(() => {
    const nextBuckets: Array<Array<{ item: T; index: number }>> = Array.from(
      { length: cols },
      () => [],
    );
    const nextHeights: number[] = Array.from({ length: cols }, () => 0);

    data.forEach((item, index) => {
      // `height` is the caller's full card height (image + text) and wins when
      // supplied; otherwise derive one from the image's aspect ratio.
      const h =
        item.height ??
        (item.imageSize && item.imageSize.width > 0 && item.imageSize.height > 0
          ? (columnWidth * item.imageSize.height) / item.imageSize.width
          : estimatedHeight);

      let shortest = 0;
      for (let c = 1; c < cols; c++) {
        if (nextHeights[c] < nextHeights[shortest]) shortest = c;
      }

      nextBuckets[shortest].push({ item, index });
      nextHeights[shortest] += h + gap;
    });

    return nextBuckets;
  }, [data, cols, columnWidth, estimatedHeight, gap]);

  if (!data.length) {
    return <View style={style}>{ListEmptyComponent}</View>;
  }

  return (
    <View style={style}>
      <View style={[styles.row, { gap }]}>
        {buckets.map((bucket, c) => (
          <View key={c} style={{ width: columnWidth, gap }}>
            {bucket.map(({ item, index }) => (
              <React.Fragment key={index}>{renderItem(item, index)}</React.Fragment>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
