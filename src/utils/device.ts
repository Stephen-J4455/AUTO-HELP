import { Dimensions, PixelRatio, Platform } from 'react-native';

/**
 * Approximates the device's physical screen corner radius (in dp) so UI
 * elements (search bars, active nav cards) can match the device's rounded
 * corners. On Android we read the system corner radius; on iOS we use the
 * well-known radii per device family; web/unknown falls back to a sensible
 * default.
 */
export function getDeviceCornerRadius(): number {
  if (Platform.OS === 'android') {
    try {
      // @ts-ignore - PlatformConstants / DisplayMetrics is not typed.
      const { PlatformConstants } = require('react-native');
      const metrics = PlatformConstants?.getConstants?.() ?? PlatformConstants;
      const r = metrics?.DisplayMetrics?.RoundedCornerRadius;
      if (typeof r === 'number' && r > 0) {
        // DisplayMetrics returns pixels; convert to dp.
        return Math.round(r / PixelRatio.get());
      }
    } catch {
      /* fall through to default */
    }
  }

  if (Platform.OS === 'ios') {
    const { width, height } = Dimensions.get('window');
    const minSide = Math.min(width, height);
    // Rough device-family mapping based on shortest side.
    if ((Platform as any).isPad) {
      return 18;
    }
    if (minSide >= 420) {
      // iPhone 12/13/14/15/16 family
      return 47;
    }
    if (minSide >= 380) {
      // iPhone XR / 11 family
      return 39;
    }
    return 33;
  }

  return 24;
}

export const DEVICE_CORNER_RADIUS = getDeviceCornerRadius();