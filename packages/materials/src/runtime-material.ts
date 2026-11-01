export type { RuntimeMaterialProps } from '@origamix/runtime';

/** Material events carry serializable business data instead of native control events. */
export type MaterialEventProps<Props, Events extends keyof Props> = Omit<Props, Events> & {
  [Event in Events]?: (payload: Record<string, unknown>) => void;
};
