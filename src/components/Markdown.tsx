import React from 'react';
import { Text, View, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../theme';

// A tiny, dependency-free Markdown renderer for chat messages.
// Supports: headings (#..###), bold **x**, italic *x*, inline code `x`,
// unordered lists (- / *), ordered lists (1.), and line breaks / paragraphs.
// It's intentionally minimal — enough to make the assistant's replies
// readable without pulling in a heavy markdown library.

type Token =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string };

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

function renderInline(text: string, base: TextStyle, codeBg: string): React.ReactNode[] {
  const tokens = parseInline(text);
  return tokens.map((t, idx) => {
    if (t.type === 'bold') {
      return (
        <Text key={idx} style={[base, styles.bold]}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'italic') {
      return (
        <Text key={idx} style={[base, styles.italic]}>
          {t.value}
        </Text>
      );
    }
    if (t.type === 'code') {
      return (
        <Text key={idx} style={[styles.code, { backgroundColor: codeBg }]}>
          {t.value}
        </Text>
      );
    }
    return (
      <Text key={idx} style={base}>
        {t.value}
      </Text>
    );
  });
}

export default function Markdown({ content, color }: { content: string; color: string }) {
  const { colors } = useTheme();
  const base: TextStyle = { color, fontSize: 14, lineHeight: 20 };
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
            <Text style={[base, styles.listMarker]}>{ordered ? `${listStart + idx}.` : '•'}</Text>
            <Text style={[base, styles.listText]}>{renderInline(item, base, `${colors.primary}14`)}</Text>
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
      const sizes = [18, 16, 15];
      blocks.push(
        <Text key={`h-${lineIdx}`} style={[base, styles.heading, { fontSize: sizes[level - 1], color }]}>
          {renderInline(headingMatch[2], base, `${colors.primary}14`)}
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
        {renderInline(line, base, `${colors.primary}14`)}
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
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  listWrap: { marginBottom: 6, marginLeft: 2 },
  listItem: { flexDirection: 'row', marginBottom: 2 },
  listMarker: { width: 18, fontWeight: '800' },
  listText: { flex: 1 },
  spacer: { height: 4 },
});