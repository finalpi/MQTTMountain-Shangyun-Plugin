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
  if (moduleCode === '0') return '飞行器';
  if (moduleCode === '3') return '机场';
  return `模块 ${moduleCode}`;
}

export function createProfileId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nextProfileName(existingNames: string[]): string {
  const used = new Set(existingNames.map((item) => item.trim()).filter(Boolean));
  let index = 1;
  while (used.has(`配置 ${index}`)) index += 1;
  return `配置 ${index}`;
}

export function defaultExpireMs(): number {
  return Date.now() + 24 * 60 * 60 * 1000;
}

export function emptyOssProfile(name = '配置 1'): OssProfile {
  return {
    id: createProfileId(),
    name,
    provider: 'ali',
    region: '',
    bucket: '',
    endpoint: '',
    keyPrefix: '',
    expire: String(defaultExpireMs()),
    access_key_id: '',
    access_key_secret: '',
    security_token: ''
  };
}
