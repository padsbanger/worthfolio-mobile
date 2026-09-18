import type { TextStyle } from 'react-native';

export const colors = {
  background: '#0C0E12', surface: '#15181E', elevated: '#20252D', border: '#2B313B',
  text: '#F4F6FA', muted: '#A5ADBA', accent: '#9AAEFF', positive: '#67D9AE',
  negative: '#FF8795', warning: '#EBC780',
};

export const spacing = { tight: 4, small: 8, section: 12, screen: 16, bottom: 24 };
export const shape = { card: 16, control: 12, logo: 8 };
export const sizing = { touch: 48, logo: 32, detailLogo: 40 };
export const typography = {
  balance: { fontSize: 36, lineHeight: 44, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.5 },
  section: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24 },
  metric: { fontSize: 16, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
  label: { fontSize: 13, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 18 },
} satisfies Record<string, TextStyle>;
