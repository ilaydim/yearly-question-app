import { forwardRef } from 'react';
import { useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import LottieView from 'lottie-react-native';

import penWritingLight from '../assets/animations/pen_writing_light.json';
import penWritingDark from '../assets/animations/pen_writing_dark.json';

interface PenWritingAnimationProps {
  autoPlay?: boolean;
  loop?: boolean;
  onAnimationFinish?: (isCancelled: boolean) => void;
  scheme?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
}

const PenWritingAnimation = forwardRef<LottieView, PenWritingAnimationProps>(
  ({ autoPlay = true, loop = true, onAnimationFinish, scheme, style }, ref) => {
    const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    const resolved = scheme ?? systemScheme;
    const source = resolved === 'dark' ? penWritingDark : penWritingLight;

    return (
      <LottieView
        ref={ref}
        source={source}
        autoPlay={autoPlay}
        loop={loop}
        onAnimationFinish={onAnimationFinish}
        style={style ?? { width: 300, height: 200 }}
      />
    );
  }
);

PenWritingAnimation.displayName = 'PenWritingAnimation';

export default PenWritingAnimation;
