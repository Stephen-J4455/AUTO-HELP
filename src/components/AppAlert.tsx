import React, { createContext, useContext, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export type AppAlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AppAlertOptions = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
};

type AppAlertContextType = {
  show: (options: AppAlertOptions) => void;
};

const AppAlertContext = createContext<AppAlertContextType | undefined>(undefined);

export const AppAlertProvider = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);
  const [options, setOptions] = useState<AppAlertOptions>({ title: '' });

  const show = useCallback((opts: AppAlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const handlePress = (btn?: AppAlertButton) => {
    setVisible(false);
    btn?.onPress?.();
  };

  const buttons =
    options.buttons && options.buttons.length ? options.buttons : [{ text: 'OK' }];

  return (
    <AppAlertContext.Provider value={{ show }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <Pressable
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <Text style={[styles.title, { color: colors.text }]}>{options.title}</Text>
            {options.message ? (
              <Text style={[styles.message, { color: colors.muted }]}>
                {options.message}
              </Text>
            ) : null}
            <View style={styles.actions}>
              {buttons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                return (
                  <Pressable
                    key={i}
                    style={[
                      styles.actionBtn,
                      isDestructive && { backgroundColor: '#B91C1C' },
                    ]}
                    onPress={() => handlePress(btn)}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        { color: isDestructive ? '#ffffff' : colors.primary },
                      ]}
                    >
                      {btn.text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppAlertContext.Provider>
  );
};

export const useAppAlert = (): AppAlertContextType => {
  const ctx = useContext(AppAlertContext);
  if (!ctx) {
    throw new Error('useAppAlert must be used within an AppAlertProvider');
  }
  return ctx;
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '800',
  },
});