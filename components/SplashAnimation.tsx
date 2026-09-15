import { useEffect } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import RingsIcon from './RingsIcon';
import { REST_BACKGROUND, SPLASH_FILL_COLOR } from '../lib/rings';

const GROW_DURATION = 1000;
const FADE_DURATION = 600;

interface SplashAnimationProps {
  onFinish: () => void;
}

export default function SplashAnimation({ onFinish }: SplashAnimationProps) {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const scale = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const bgProgress = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(4.5, {
      duration: GROW_DURATION,
      easing: Easing.bezier(0.3, 0.6, 0.35, 1),
    });
    iconOpacity.value = withSequence(
      withTiming(1, { duration: GROW_DURATION * 0.3, easing: Easing.linear }),
      withTiming(1, { duration: GROW_DURATION * 0.7 }),
      withTiming(0, { duration: FADE_DURATION, easing: Easing.ease })
    );
    bgProgress.value = withDelay(
      GROW_DURATION,
      withTiming(1, { duration: FADE_DURATION, easing: Easing.ease }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
  }, [scale, iconOpacity, bgProgress, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      bgProgress.value,
      [0, 1],
      [REST_BACKGROUND[scheme], SPLASH_FILL_COLOR[scheme]]
    ),
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <Animated.View style={iconStyle}>
        <RingsIcon size={140} scheme={scheme} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
