import { colors } from '../theme/theme';

function luminance(hex: string) {
  const channels = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255);
  const linear = channels.map(value => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}
function contrast(foreground: string, background: string) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

test('financial and action text colors retain normal-text contrast against the app background', () => {
  for (const color of [colors.text, colors.muted, colors.accent, colors.positive, colors.negative, colors.warning]) {
    expect(contrast(color, colors.background)).toBeGreaterThanOrEqual(4.5);
  }
});
