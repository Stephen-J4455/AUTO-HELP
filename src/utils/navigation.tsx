import React from 'react';
import { NavigationContainerRef } from '@react-navigation/native';

// A process-wide reference to the root NavigationContainer so screens that
// are rendered outside the normal stack (e.g. the global ChatBot launcher)
// can navigate to product/vehicle detail pages.

export const navigationRef = React.createRef<NavigationContainerRef<any>>();

export function navigateGlobal(name: string, params?: any) {
  if (navigationRef.current?.isReady()) {
    navigationRef.current.navigate(name, params);
  }
}