import React from 'react';
import { Linking, Platform, Text, View, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../theme';

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string; url: string };

function parseInline(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let buf = '';
  const flush = () => {
    if (buf) {
      tokens.push({ type: 'text', value: buf });
      buf = '';
    }
  };
  while (i < text.length) {
    const ch = text[i];
    if (ch === '[') {
      const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/i.exec(text.slice(i));
      if (link) {
        flush();
        tokens.push({ type: 'link', value: link[1], url: link[2] });
        i += link[0].length;
        continue;
      }
    }
    // inline code
    if (ch === '`' && text[i + 1] !== '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i) {
        flush();
        tokens.push({ type: 'code', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    // bold
    if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end > i) {
        flush();
        tokens.push({ type: 'bold', value: text.slice(i + 2, end) });
        i = end + 2;
        continue;
      }
    }
    // italic
    if (ch === '*') {
      const end = text.indexOf('*', i + 1);
      if (end > i) {
        flush();
        tokens.push({ type: 'italic', value: text.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return tokens;
}

function renderInline(text: string, { accentText, surface }: ReturnType<typeof useTheme>['colors']): React.ReactNode[] {
  const tokens = parseInline(text);
  return tokens.map((t, idx) => {
    if (t.type === 'bold') {
      return (
        <Text key={idx} style={styles.bold}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'italic') {
      return (
        <Text key={idx} style={styles.italic}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'code') {
      return (
        <Text key={idx} style={[styles.code, { backgroundColor: surface, color: accentText }]}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'link') {
      const linkProps = Platform.OS === 'web'
        ? { href: t.url, hrefAttrs: { target: '_blank', rel: 'noopener noreferrer' } }
        : { onPress: () => { void Linking.openURL(t.url).catch(() => {}); } };
      return (
        <Text key={idx} accessibilityRole="link" style={[styles.link, { color: accentText }]} {...linkProps}>
          {t.value}
        </Text>
      );
    }
    return t.value;
  });
}

export default function Markdown({ content }: { content: string }) {
  const { colors } = useTheme();
  const base: TextStyle = { color: colors.text, fontSize: 16, lineHeight: 24 };
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let listStart = 0;

  const flushList = (key: string) => {
    if (!listItems.length) return;
    const ordered = listType === 'ol';
    blocks.push(
      <View key={key} style={styles.listWrap}>
        {listItems.map((item, idx) => (
          <View key={idx} style={styles.listItem}>
            <Text style={[base, styles.listMarker, { color: colors.accentText }]}>{ordered ? `${listStart + idx}.` : '•'}</Text>
            <Text style={[base, styles.listText]}>{renderInline(item, colors)}</Text>
          </View>
        ))}
      </View>
    );
    listItems = [];
    listType = null;
  };

  lines.forEach((raw, lineIdx) => {
    const line = raw.trimEnd();
    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    const ulMatch = /^[-*]\s+(.*)$/.exec(line);
    const olMatch = /^(\d+)\.\s+(.*)$/.exec(line);

    if (headingMatch) {
      flushList(`l-${lineIdx}`);
      const level = headingMatch[1].length;
      const fontSize = [22, 19, 17][level - 1];
      blocks.push(
        <Text key={`h-${lineIdx}`} accessibilityRole="header" style={[base, styles.heading, { fontSize, lineHeight: fontSize + 6, color: colors.accentText }]}>
          {renderInline(headingMatch[2], colors)}
        </Text>
      );
      return;
    }

    if (ulMatch) {
      if (listType !== 'ul') {
        flushList(`l-${lineIdx}`);
        listType = 'ul';
      }
      listItems.push(ulMatch[1]);
      return;
    }

    if (olMatch) {
      if (listType !== 'ol') {
        flushList(`l-${lineIdx}`);
        listType = 'ol';
        listStart = parseInt(olMatch[1], 10);
      }
      listItems.push(olMatch[2]);
      return;
    }

    // empty line
    if (!line.trim()) {
      flushList(`l-${lineIdx}`);
      blocks.push(<View key={`sp-${lineIdx}`} style={styles.spacer} />);
      return;
    }

    flushList(`l-${lineIdx}`);
    blocks.push(
      <Text key={`p-${lineIdx}`} style={[base, styles.paragraph]}>
        {renderInline(line, colors)}
      </Text>
    );
  });

  flushList('l-end');

  return <View>{blocks}</View>;
}

const styles = StyleSheet.create({
  paragraph: { marginBottom: 6 },
  heading: { fontWeight: '900', marginBottom: 6, marginTop: 2 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  link: { textDecorationLine: 'underline' },
  code: {
    fontFamily: 'monospace',
    fontSize: 14,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  listWrap: { marginBottom: 6, marginLeft: 2 },
  listItem: { flexDirection: 'row', gap: 6, marginBottom: 2 },
  listMarker: { minWidth: 16, fontWeight: '800' },
  listText: { flex: 1 },
  spacer: { height: 4 },
});
