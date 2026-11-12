import {
  isProjectSettingsAgentEvent,
  type ProjectSettingsAgentRequest,
  type ProjectSettingsAgentEvent,
} from '@origamix/shared';
import { requestStream } from './request';

export const assistProjectSettings = (
  input: ProjectSettingsAgentRequest,
  signal: AbortSignal,
  receive: (event: ProjectSettingsAgentEvent) => void,
): Promise<void> =>
  requestStream('/projects/settings/assist', input, signal, (value) => {
    if (!isProjectSettingsAgentEvent(value)) throw new Error('布局助手返回结果无效');
    receive(value);
  });
