import { useColorScheme } from 'react-native';

export const light = {
  primary: '#800020',
  accentText: '#800020',
  danger: '#b32e26',
  background: '#f7f5f4',
  surface: '#ffffff',
  text: '#211b1d',
  muted: '#675d61',
  border: '#e5dde0',
  overlay: 'rgba(20,10,14,0.28)',
};

export const dark = {
  primary: '#b23a59',
  accentText: '#e18fa5',
  danger: '#ff7979',
  background: '#181416',
  surface: '#242022',
  text: '#fff6f8',
  muted: '#c9bcc1',
  border: '#483b40',
  overlay: 'rgba(0,0,0,0.50)',
};

export function useTheme() {
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? dark : light;
  return { colors, scheme };
}

export default { light, dark, useTheme };
