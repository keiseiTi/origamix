import { useEffect, useRef } from 'react';
import { toast } from '@origamix/ui';

export const ErrorToast = ({ message }: { message: string | null | undefined }): null => {
  const notified = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (message && message !== notified.current) toast.add({ title: message, type: 'error' });
    notified.current = message;
  }, [message]);
  return null;
};
