import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';
import { chartGeometry, nearestPoint, type ChartPoint, type Observation } from '../lib/chart';
import type { Trade } from '../api/contracts';
import { money, timestamp } from '../lib/format';
import { colors, spacing } from '../theme/theme';
import { styles } from './ui';

type ChartTrade = Pick<Trade, 'side' | 'time'>;

export function PriceChart({ observations, currency, trades = [] }: { observations: Observation[]; currency: string; trades?: ChartTrade[] }) {
  const [width, setWidth] = useState(280);
  const [selected, setSelected] = useState<ChartPoint | null>(null);
  const { fontScale } = useWindowDimensions();
  const geometry = useMemo(() => chartGeometry(observations, width, 200), [observations, width]);
  const markers = useMemo(() => tradeMarkers(geometry.points, trades), [geometry.points, trades]);
  const inspected = selected && geometry.points.find(p => p.time === selected.time) || geometry.points.at(-1);
  if (!geometry.points.length) return <Text style={styles.label}>No real price history is available for this range.</Text>;
  return <View style={{ gap: spacing.small }}>
    <View style={local.inspection}><View style={local.inspectionRow}><Text style={local.inspectionLabel}>Inspected close</Text><Text style={styles.text} accessibilityLiveRegion="polite">{money(inspected?.close, currency)}</Text></View>
      <Text style={styles.small}>{timestamp(inspected?.time, true)}</Text></View>
    <View style={local.plotRow}>
    <View style={local.axis} accessibilityLabel={`Price scale in ${currency === 'GBX' ? 'GBP' : currency}`}>
      <View style={{ opacity: 0 }} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {geometry.ticks.map(tick => <Text key={tick.y} style={styles.small}>{money(tick.value, currency)}</Text>)}
      </View>
      {geometry.ticks.map(tick => <Text key={tick.y} style={[styles.small, local.axisLabel, { top: tick.y - 9 * fontScale }]}>{money(tick.value, currency)}</Text>)}
    </View>
    <View style={{ flex: 1 }} onLayout={event => setWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="adjustable"
      accessibilityLabel="Price history" accessibilityValue={{ text: `${money(inspected?.close, currency)}, ${timestamp(inspected?.time, true)}` }}
      accessibilityHint="Swipe up or down to inspect adjacent observations. Touch and drag to inspect the chart."
      accessibilityActions={[{ name: 'increment', label: 'Next observation' }, { name: 'decrement', label: 'Previous observation' }]}
      onAccessibilityAction={event => {
        if (!['increment', 'decrement'].includes(event.nativeEvent.actionName)) return;
        const index = geometry.points.findIndex(p => p.time === inspected?.time);
        setSelected(geometry.points[Math.max(0, Math.min(geometry.points.length - 1, index + (event.nativeEvent.actionName === 'increment' ? 1 : -1)))]!);
      }}
      onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => true}
      onResponderGrant={event => setSelected(nearestPoint(geometry.points, event.nativeEvent.locationX))}
      onResponderMove={event => setSelected(nearestPoint(geometry.points, event.nativeEvent.locationX))}>
      <Svg width={width} height={200} pointerEvents="none" accessible={false}>
        {geometry.ticks.map(({ y }) => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={colors.border} strokeDasharray="3 6" />)}
        <Path d={geometry.path} stroke={colors.accent} strokeWidth={2.5} fill="none" />
        {markers.map(marker => <Polygon key={marker.key} points={marker.points} fill={marker.side === 'buy' ? colors.positive : colors.negative} stroke={colors.surface} strokeWidth={1.5} />)}
        {inspected && <><Line x1={inspected.x} x2={inspected.x} y1={0} y2={200} stroke={colors.muted} strokeDasharray="3 5" />
          <Circle cx={inspected.x} cy={inspected.y} r={5} fill={colors.accent} stroke={colors.surface} strokeWidth={2} /></>}
      </Svg>
    </View>
    </View>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
      <Text style={styles.small}>{new Date(geometry.points[0]!.time).toLocaleDateString('en')}</Text>
      <Text style={styles.small}>{new Date(geometry.points.at(-1)!.time).toLocaleDateString('en')}</Text>
    </View>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}><Text style={styles.small}>Low close {money(geometry.low, currency)}</Text><Text style={styles.small}>High close {money(geometry.high, currency)}</Text></View>
    {!!markers.length && <View accessibilityLabel={`${markers.filter(marker => marker.side === 'buy').length} buy and ${markers.filter(marker => marker.side === 'sell').length} sell markers in this chart range`} style={local.legend}>
      <View style={styles.row}><View style={[local.legendDot, { backgroundColor: colors.positive }]} /><Text style={styles.small}>Buy</Text></View>
      <View style={styles.row}><View style={[local.legendDot, { backgroundColor: colors.negative }]} /><Text style={styles.small}>Sell</Text></View>
    </View>}
    <Text style={styles.small}>Touch the chart to inspect a price.</Text>
  </View>;
}

const local = StyleSheet.create({
  inspection: { gap: 2, paddingVertical: spacing.small },
  inspectionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: spacing.tight },
  inspectionLabel: { ...styles.small, color: colors.muted },
  plotRow: { flexDirection: 'row', gap: spacing.small },
  axis: { maxWidth: '40%' },
  axisLabel: { position: 'absolute', right: 0, textAlign: 'right' },
  legend: { flexDirection: 'row', gap: spacing.screen, flexWrap: 'wrap' },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});

function tradeMarkers(points: ChartPoint[], trades: ChartTrade[]) {
  if (!points.length) return [] as { key: string; side: 'buy' | 'sell'; points: string }[];
  const start = Date.parse(points[0]!.time);
  const end = Date.parse(points.at(-1)!.time);
  return trades.flatMap((trade, index) => {
    const time = Date.parse(trade.time);
    if (!Number.isFinite(time) || time < start || time > end) return [];
    const point = nearestPoint(points, 8 + (time - start) / Math.max(1, end - start) * Math.max(0, points.at(-1)!.x - 8));
    if (!point) return [];
    const y = point.y + (trade.side === 'buy' ? 12 : -12);
    const triangle = trade.side === 'buy'
      ? `${point.x - 6},${y - 4} ${point.x + 6},${y - 4} ${point.x},${y + 6}`
      : `${point.x - 6},${y + 4} ${point.x + 6},${y + 4} ${point.x},${y - 6}`;
    return [{ key: `${trade.side}:${trade.time}:${index}`, side: trade.side, points: triangle }];
  });
}
