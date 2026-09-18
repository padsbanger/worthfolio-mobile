import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { server } from '../lib/config';
import { ticker } from '../lib/format';
import { colors, sizing } from '../theme/theme';

type Props = { symbol: string; logoUrl?: string | null; logoFallbackUrl?: string | null; size?: number };

export function logoUri(value: string | null | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim(), server.url || undefined);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function CompanyLogo(props: Props) {
  // Reset failed-image state for recycled rows or changed backend URLs, not each poll.
  return <LogoImage key={JSON.stringify([props.symbol, props.logoUrl, props.logoFallbackUrl])} {...props} />;
}

function LogoImage({ symbol, logoUrl, logoFallbackUrl, size = sizing.logo }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const uri = [logoUri(logoUrl), logoUri(logoFallbackUrl)].find(value => value && !failed.includes(value));
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.frame, { width: size, height: size, borderRadius: size / 4 }]}>
    <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{ticker(symbol).slice(0, 2).toUpperCase()}</Text>
    {uri && <Image key={uri} source={{ uri }} resizeMode="contain" accessible={false}
      style={[StyleSheet.absoluteFill, styles.image]}
      onError={() => setFailed(previous => [...previous, uri])} />}
  </View>;
}

const styles = StyleSheet.create({
  frame: { flexShrink: 0, overflow: 'hidden', backgroundColor: colors.elevated, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.muted, fontWeight: '600' },
  image: { backgroundColor: '#FFFFFF' },
});
