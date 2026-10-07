import { Modal, View, Button } from 'react-native';
import { PluggyConnect } from 'react-native-pluggy-connect';
export type WidgetProps = {
  token: string; onSuccess: (id: string) => void;
  onClose: () => void; onError: (message: string) => void;
};
export default function WidgetBanco({ token, onSuccess, onClose, onError }: WidgetProps) {
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <View style={{ flex: 1, paddingTop: 48, paddingBottom: 24 }}>
      <Button title="Fechar conexão" onPress={onClose} />
      <PluggyConnect connectToken={token} includeSandbox={true}
        onSuccess={({ item }) => onSuccess(item.id)}
        onError={() => onError('Falha no widget. Confira a mensagem apresentada pelo Pluggy.')}
        onClose={onClose} />
    </View>
  </Modal>;
}
