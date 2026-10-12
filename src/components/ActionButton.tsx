import { Pressable, StyleSheet, Text, type ButtonProps } from 'react-native';
import { colors } from '../theme';
export default function ActionButton({ title, onPress, disabled, accessibilityLabel, testID }: ButtonProps) {
  const danger = /excluir|desconectar/i.test(title);
  const secondary = /cancelar|sair|fechar/i.test(title);
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}
    accessibilityState={{ disabled: !!disabled }} testID={testID} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, danger && styles.danger, secondary && styles.secondary,
      pressed && styles.pressed, disabled && styles.disabled]}>
    <Text style={[styles.label, danger && styles.dangerLabel, secondary && styles.secondaryLabel]}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 46, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 18,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary },
  label: { color: '#071522', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border }, secondaryLabel: { color: colors.ink },
  danger: { backgroundColor: '#351E2B', borderColor: '#754253' }, dangerLabel: { color: colors.expense },
  pressed: { opacity: 0.82 }, disabled: { opacity: 0.45 },
});
