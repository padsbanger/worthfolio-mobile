import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { chartGeometry, nearestPoint, type ChartPoint, type Observation } from '../lib/chart';
import { money, timestamp } from '../lib/format';
import { colors } from '../theme/theme';
import { styles } from './ui';

export function PriceChart({ observations, currency }: { observations: Observation[]; currency: string }) {
  const [width, setWidth] = useState(280);
  const [selected, setSelected] = useState<ChartPoint | null>(null);
  const geometry = useMemo(() => chartGeometry(observations, width, 200), [observations, width]);
  const inspected = selected && geometry.points.find(p => p.time === selected.time) || geometry.points.at(-1);
  if (!geometry.points.length) return <Text style={styles.label}>No real price history is available for this range.</Text>;
  return <View style={{ gap: 12 }}>
    <Text style={styles.text} accessibilityLiveRegion="polite">{money(inspected?.close, currency)} · {timestamp(inspected?.time, true)}</Text>
    <View onLayout={event => setWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="adjustable"
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
        {[40, 100, 160].map(y => <Line key={y} x1={0} x2={width} y1={y} y2={y} stroke={colors.border} strokeDasharray="3 6" />)}
        <Path d={geometry.path} stroke={colors.accent} strokeWidth={2.5} fill="none" />
        {inspected && <><Line x1={inspected.x} x2={inspected.x} y1={0} y2={200} stroke={colors.muted} strokeDasharray="3 5" />
          <Circle cx={inspected.x} cy={inspected.y} r={5} fill={colors.accent} stroke={colors.surface} strokeWidth={2} /></>}
      </Svg>
    </View>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
      <Text style={styles.small}>{new Date(geometry.points[0]!.time).toLocaleDateString('en')}</Text>
      <Text style={styles.small}>{new Date(geometry.points.at(-1)!.time).toLocaleDateString('en')}</Text>
    </View>
    <Text style={styles.small}>Touch the chart to inspect a price.</Text>
  </View>;
}
