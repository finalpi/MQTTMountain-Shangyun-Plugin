import type { HostSnapshot, OssProfile } from '../types/panel';

export function emptySnapshot(): HostSnapshot {
  return {
    selectedConnectionId: null,
    selectedConnectionState: 'idle',
    connections: [],
    messages: [],
    publishHistory: [],
    paramSuggestions: {
      sn: [],
      airportSn: [],
      gateway: [],
      droneSn: []
    }
  };
}

export function safeParse(text: string | undefined | null): any {
  try {
    return JSON.parse(text || '');
  } catch {
    return null;
  }
}

export function timeText(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function shortTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function toMs(ts: number): number {
  if (!ts) return 0;
  return ts > 1e12 ? ts : ts * 1000;
}

export function bytesText(size: number): string {
  const n = Number(size || 0);
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

export function formatDateInput(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDateInput(value: string, fallback: number): number {
  if (!value) return fallback;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : fallback;
}

export function moduleLabel(moduleCode: string): string {
  return moduleCode === '0' ? '飞行器' : moduleCode === '3' ? '机场' : `模块 ${moduleCode}`;
}

export function createProfileId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

export function emptyOssProfile(name = '默认配置'): OssProfile {
  return {
    id: createProfileId(),
    name,
    provider: 'ali',
    region: '',
    bucket: '',
    endpoint: '',
    keyPrefix: '',
    expire: '',
    access_key_id: '',
    access_key_secret: '',
    security_token: ''
  };
}
