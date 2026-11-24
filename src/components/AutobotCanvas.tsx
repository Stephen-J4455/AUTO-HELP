import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from './Markdown';
import { useTheme } from '../theme';
import type { CanvasProduct, Fitment, FlowBlock } from '../utils/chatbot';
import { toPublicProductImageUrl } from '../utils/productImages';
import { formatCedis } from '../utils/currency';

const LABELS: Record<FlowBlock['kind'], string> = {
  part: 'Part', photos: 'Photos', fitment: 'Fitment', text: 'Text',
};

function fitmentLabel({ make, model, trim, year, yearFrom, yearTo }: Fitment) {
  const years = year ?? (yearFrom && yearTo && yearFrom !== yearTo ? `${yearFrom}–${yearTo}` : yearFrom ?? yearTo);
  return [make, model, trim, years].filter(Boolean).join(' ');
}

function ProductPhoto({ path, label }: { path: string; label: string }) {
  const [aspectRatio, setAspectRatio] = useState(1);
  return <Image source={{ uri: toPublicProductImageUrl(path) }} resizeMode="contain"
    style={[styles.photo, { aspectRatio }]} accessibilityLabel={label}
    onLoad={({ nativeEvent: { source } }) => {
      if (source?.width > 0 && source.height > 0) setAspectRatio(source.width / source.height);
    }} />;
}

export default function AutobotCanvas({ blocks, products, onMove, onOpenPart }: {
  blocks: FlowBlock[];
  products: CanvasProduct[];
  onMove?: (index: number, offset: -1 | 1) => void;
  onOpenPart: (id: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.flow}>
      {blocks.map((block, index) => {
        const product = block.kind === 'text' ? undefined : products.find(({ id }) => id === block.productId);
        if (block.kind !== 'text' && !product) return null;
        const images = product?.images ?? [];
        return (
          <View key={block.kind === 'text' ? `text:${index}` : `${block.kind}:${block.productId}`}
            style={[styles.block, block.kind !== 'photos' && styles.inset]}>
            {onMove && (
              <View style={[styles.arrange, block.kind === 'photos' && styles.inset]}>
                <Text style={[styles.arrangeLabel, { color: colors.muted }]}>{LABELS[block.kind]}</Text>
                {([-1, 1] as const).map((offset) => {
                  const disabled = index + offset < 0 || index + offset >= blocks.length;
                  return (
                    <Pressable key={offset} accessibilityRole="button" accessibilityLabel={`Move ${LABELS[block.kind].toLowerCase()} ${offset < 0 ? 'up' : 'down'}`}
                      disabled={disabled} onPress={() => onMove(index, offset)} style={[styles.move, { opacity: disabled ? 0.3 : 1 }]}>
                      <Ionicons name={offset < 0 ? 'arrow-up' : 'arrow-down'} size={17} color={colors.text} />
                    </Pressable>
                  );
                })}
              </View>
            )}

            {block.kind === 'text' && <Markdown content={block.text} />}

            {block.kind === 'part' && product && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Open ${product.title}`} onPress={() => onOpenPart(product.id)}
                style={({ pressed }) => [styles.part, { opacity: pressed ? 0.65 : 1 }]}>
                <View style={styles.partText}>
                  <Text style={[styles.partTitle, { color: colors.accentText }]}>{product.title}</Text>
                  {!!(product.brand || product.sku) && <Text style={{ color: colors.muted }}>{[product.brand, product.sku && `SKU ${product.sku}`].filter(Boolean).join(' · ')}</Text>}
                </View>
                {product.price !== null && <Text style={[styles.price, { color: colors.text }]}>{formatCedis(product.price)}</Text>}
                <Ionicons name="arrow-forward" size={18} color={colors.accentText} />
              </Pressable>
            )}

            {block.kind === 'photos' && product && (
              <View style={styles.photos}>
                {images.map((path, imageIndex) => (
                  <ProductPhoto key={path} path={path} label={`${product.title} photo ${imageIndex + 1}`} />
                ))}
              </View>
            )}

            {block.kind === 'fitment' && product && (
              <View style={styles.fitments} accessibilityLabel={`Listed fitments for ${product.title}`}>
                {[...new Set(product.fitments.map(fitmentLabel))].map((label) => (
                  <View key={label} style={styles.fitment}>
                    <Ionicons name="car-outline" size={17} color={colors.accentText} />
                    <Text style={[styles.fitmentText, { color: colors.text }]}>{label}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { gap: 9 },
  block: { minWidth: 0 },
  inset: { marginHorizontal: 16 },
  arrange: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  arrangeLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  move: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  part: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  partText: { flex: 1, gap: 3 },
  partTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  price: { fontSize: 15, fontWeight: '800' },
  photos: { gap: 10 },
  photo: { width: '100%' },
  fitments: { gap: 5 },
  fitment: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fitmentText: { flex: 1, fontSize: 15, lineHeight: 21 },
});
