import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PluggyConnect } from 'react-pluggy-connect';

type Props = {
  token: string;
  onSuccess: (id: string) => void;
  onClose: () => void;
  onError: (message: string) => void;
};

export default function WidgetBanco({ token, onSuccess, onClose, onError }: Props) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = document.createElement('div');
    element.dataset.fintrackWidget = 'true';
    Object.assign(element.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      isolation: 'isolate',
      pointerEvents: 'auto',
    });
    document.body.appendChild(element);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setHost(element);
    return () => {
      element.remove();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!host) return null;
  return createPortal(
    <PluggyConnect
      connectToken={token}
      includeSandbox={true}
      onSuccess={({ item }) => onSuccess(item.id)}
      onError={() => onError('Falha no widget. Confira a mensagem apresentada pelo Pluggy.')}
      onClose={onClose}
    />,
    host,
  );
}
