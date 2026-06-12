import { useColorScheme } from 'react-native';

export const light = {
  primary: '#800020',
  background: '#f2f2f2',
  surface: '#ffffff',
  text: '#000000',
  muted: '#666666',
  overlay: 'rgba(0,0,0,0.2)'
};

export const dark = {
  primary: '#800020',
  background: '#000000',
  surface: '#000000',
  text: '#ffffff',
  muted: '#dddddd',
  overlay: 'rgba(0,0,0,0.45)'
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  return { colors, scheme };
}

export default { light, dark, useTheme };
