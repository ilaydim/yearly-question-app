import { useColorScheme } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { RING_COLORS, RING_RADII } from '../lib/rings';

interface RingsIconProps {
  size: number;
  scheme?: 'light' | 'dark';
}

export default function RingsIcon({ size, scheme }: RingsIconProps) {
  const systemScheme = useColorScheme();
  const resolved = scheme ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const colors = RING_COLORS[resolved];

  return (
    <Svg width={size} height={size} viewBox="0 0 140 140">
      {RING_RADII.map((r, i) => (
        <Circle key={r} cx={70} cy={70} r={r} fill={colors[i]} />
      ))}
    </Svg>
  );
}
