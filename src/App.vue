<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';

interface HostConnection {
  id: string;
  name: string;
  state: string;
}

interface CloudMeta {
  family?: string;
  airportSn?: string;
  droneSn?: string;
  gatewaySn?: string;
  deviceSn?: string;
  topicKind?: string;
  messageKind?: string;
  direction?: 'up' | 'down';
  method?: string;
  tid?: string;
  bid?: string;
  seq?: number;
  isReply?: boolean;
  debugState?: 'enabled' | 'disabled';
  modeCode?: number;
  [key: string]: unknown;
}

interface TimelineRow {
  time: number;
  topic: string;
  payload: string;
  decoded?: { meta?: CloudMeta } | null;
}

interface PublishHistoryRow {
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
  time: number;
}

interface HostSnapshot {
  selectedConnectionId: string | null;
  selectedConnectionState: string;
  connections: HostConnection[];
  messages: TimelineRow[];
  publishHistory: PublishHistoryRow[];
  paramSuggestions: Record<string, string[]>;
}

interface PublishMeta {
  airportSn?: string;
  droneSn?: string;
  tid?: string;
  bid?: string;
  seq?: number;
  method?: string;
}

interface PublishEntry {
  key: string;
  item: PublishHistoryRow;
  meta: PublishMeta;
}

interface LogEntry {
  module: string;
  deviceSn: string;
  bootIndex: number;
  startTime: number;
  endTime: number;
  size: number;
  result: number;
}

interface OssProfile {
  id: string;
  name: string;
  provider: string;
  region: string;
  bucket: string;
  endpoint: string;
  keyPrefix: string;
  expire: string;
  access_key_id: string;
  access_key_secret: string;
  security_token: string;
}

interface UploadProgressRow {
  key: string;
  module: string;
  deviceSn: string;
  size: number;
  fingerprint: string;
  progress: number;
  uploadRate: number;
  finishTime: number;
  status: string;
  result: number;
  time: number;
}

const OSS_STORAGE_KEY = 'mm.plugin.dji.oss-profiles.v1';
const host = window.MqttMountainHost || {};
const bridge = host.bridge;

const snapshot = ref<HostSnapshot>(emptySnapshot());
const airport = ref('all');
const drone = ref('all');
const selectedHistoryKey = ref<string | null>(null);
const actionBusy = ref(false);
const feedback = ref('');
const feedbackTone = ref<'info' | 'error'>('info');
const logEntries = ref<LogEntry[]>([]);
const selectedLogKeys = ref<Record<string, boolean>>({});
const uploadRequest = ref<{ time: number; modules: string[] } | null>(null);
const logStartTime = ref('');
const logEndTime = ref('');
const moduleDrone = ref(true);
const moduleDock = ref(true);

const ossProfiles = ref<OssProfile[]>([]);
const activeOssProfileId = ref('');
const ossForm = reactive<OssProfile>({
  id: '',
  name: '',
  provider: 'ali',
  region: '',
  bucket: '',
  endpoint: '',
  keyPrefix: '',
  expire: '',
  access_key_id: '',
  access_key_secret: '',
  security_token: ''
});

let profileFormSyncing = false;
let refreshTimer: number | null = null;

function emptySnapshot(): HostSnapshot {
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

function safeParse(text: string | undefined | null): any {
  try {
    return JSON.parse(text || '');
  } catch {
    return null;
  }
}

function timeText(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function shortTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toMs(ts: number): number {
  if (!ts) return 0;
  return ts > 1e12 ? ts : ts * 1000;
}

function bytesText(size: number): string {
  const n = Number(size || 0);
  if (n >= 1024 * 1024 * 1024) return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(2)} KB`;
  return `${n} B`;
}

function formatDateInput(ms: number): string {
  if (!ms) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDateInput(value: string, fallback: number): number {
  if (!value) return fallback;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : fallback;
}

function moduleLabel(moduleCode: string): string {
  return moduleCode === '0' ? '飞行器' : moduleCode === '3' ? '机场' : `模块 ${moduleCode}`;
}

function setFeedback(text: string, tone: 'info' | 'error' = 'info'): void {
  feedback.value = text;
  feedbackTone.value = tone;
}

function createProfileId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

function emptyOssProfile(name = '默认配置'): OssProfile {
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

function loadOssProfiles(): void {
  try {
    const raw = JSON.parse(localStorage.getItem(OSS_STORAGE_KEY) || '{}');
    const profiles = Array.isArray(raw.profiles) && raw.profiles.length ? raw.profiles as OssProfile[] : [emptyOssProfile()];
    ossProfiles.value = profiles;
    activeOssProfileId.value = raw.activeOssProfileId || profiles[0].id;
  } catch {
    ossProfiles.value = [emptyOssProfile()];
    activeOssProfileId.value = ossProfiles.value[0].id;
  }
}

function saveOssProfiles(): void {
  localStorage.setItem(OSS_STORAGE_KEY, JSON.stringify({
    activeOssProfileId: activeOssProfileId.value,
    profiles: ossProfiles.value
  }));
}

const activeOssProfile = computed(() => {
  return ossProfiles.value.find((item) => item.id === activeOssProfileId.value) || ossProfiles.value[0] || null;
});

function loadActiveProfileIntoForm(): void {
  const profile = activeOssProfile.value || emptyOssProfile();
  profileFormSyncing = true;
  Object.assign(ossForm, profile);
  profileFormSyncing = false;
}

function persistFormIntoProfiles(): void {
  const current = activeOssProfile.value;
  if (!current) return;
  const next = { ...current, ...ossForm };
  ossProfiles.value = ossProfiles.value.map((item) => item.id === next.id ? next : item);
  saveOssProfiles();
}

watch(activeOssProfileId, () => {
  loadActiveProfileIntoForm();
  saveOssProfiles();
}, { immediate: true });

watch(ossForm, () => {
  if (profileFormSyncing) return;
  persistFormIntoProfiles();
}, { deep: true });

function createNewProfile(): void {
  const profile = emptyOssProfile('新配置');
  ossProfiles.value = [profile, ...ossProfiles.value];
  activeOssProfileId.value = profile.id;
  saveOssProfiles();
  setFeedback('已创建新的 OSS 配置档案');
}

function deleteCurrentProfile(): void {
  if (ossProfiles.value.length <= 1) return;
  ossProfiles.value = ossProfiles.value.filter((item) => item.id !== activeOssProfileId.value);
  activeOssProfileId.value = ossProfiles.value[0].id;
  saveOssProfiles();
  setFeedback('已删除当前 OSS 配置');
}

function saveCurrentProfile(): void {
  persistFormIntoProfiles();
  setFeedback('OSS 配置已保存');
}

function historyKey(item: { time: number; topic: string; payload: string }): string {
  return `${item.time}:${item.topic}:${item.payload}`;
}

function cloudMeta(row: TimelineRow | null | undefined): CloudMeta | null {
  const meta = row?.decoded?.meta;
  return meta && meta.family === 'dji-shangyun' ? meta : null;
}

function parsePublishMeta(item: PublishHistoryRow): PublishMeta {
  const topicParts = String(item.topic || '').split('/');
  const airportSn = (topicParts[0] === 'thing' || topicParts[0] === 'sys') ? topicParts[2] : undefined;
  const parsed = safeParse(item.payload) || {};
  const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
  const pick = (...values: unknown[]) => values.find((value) => typeof value === 'string' && value.trim()) as string | undefined;
  return {
    airportSn,
    droneSn: pick(parsed.drone_sn, parsed.droneSn, data.drone_sn, data.droneSn, parsed.sub_device, data.sub_device),
    tid: typeof parsed.tid === 'string' ? parsed.tid : undefined,
    bid: typeof parsed.bid === 'string' ? parsed.bid : undefined,
    seq: typeof parsed.seq === 'number' ? parsed.seq : undefined,
    method: typeof parsed.method === 'string' ? parsed.method : undefined
  };
}

function parseRowBody(row: TimelineRow | null | undefined): any {
  return safeParse(row?.payload) || {};
}

function serviceStatusOf(row: TimelineRow): string | null {
  const body = parseRowBody(row);
  const data = body && typeof body.data === 'object' ? body.data : {};
  const output = data && typeof data.output === 'object' ? data.output : {};
  if (typeof output.status === 'string') return output.status;
  if (typeof data.result === 'number') return data.result === 0 ? 'ok' : 'failed';
  return null;
}

function selectedModules(): string[] {
  const modules: string[] = [];
  if (moduleDrone.value) modules.push('0');
  if (moduleDock.value) modules.push('3');
  return modules;
}

function logEntryKey(entry: LogEntry): string {
  return `${entry.module}:${entry.deviceSn}:${entry.bootIndex}`;
}

function flattenLogEntries(body: any): LogEntry[] {
  const files = body && body.data && Array.isArray(body.data.files) ? body.data.files : [];
  const out: LogEntry[] = [];
  files.forEach((group: any) => {
    const moduleCode = String(group.module ?? '');
    const deviceSn = String(group.device_sn || '');
    const list = Array.isArray(group.list) ? group.list : [];
    list.forEach((item: any) => {
      out.push({
        module: moduleCode,
        deviceSn,
        bootIndex: Number(item.boot_index),
        startTime: toMs(Number(item.start_time || 0)),
        endTime: toMs(Number(item.end_time || item.end_ime || 0)),
        size: Number(item.size || 0),
        result: Number(group.result || 0)
      });
    });
  });
  return out.sort((a, b) => b.startTime - a.startTime);
}

function logTimeRange(entries: LogEntry[]): { min: number; max: number } | null {
  if (!entries.length) return null;
  let min = entries[0].startTime;
  let max = entries[0].endTime;
  entries.forEach((item) => {
    if (item.startTime < min) min = item.startTime;
    if (item.endTime > max) max = item.endTime;
  });
  return { min, max };
}

function normalizeSnapshot(next: any): HostSnapshot {
  const current = next && typeof next === 'object' ? next : {};
  return {
    selectedConnectionId: current.selectedConnectionId ?? null,
    selectedConnectionState: current.selectedConnectionState ?? 'idle',
    connections: Array.isArray(current.connections) ? current.connections : [],
    messages: Array.isArray(current.messages) ? current.messages : [],
    publishHistory: Array.isArray(current.publishHistory) ? current.publishHistory : [],
    paramSuggestions: current.paramSuggestions && typeof current.paramSuggestions === 'object'
      ? current.paramSuggestions
      : { sn: [], airportSn: [], gateway: [], droneSn: [] }
  };
}

function readSnapshot(): HostSnapshot {
  if (!bridge || typeof bridge.getSnapshot !== 'function') return emptySnapshot();
  return normalizeSnapshot(bridge.getSnapshot());
}

function refreshSnapshot(): void {
  snapshot.value = readSnapshot();
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor<T>(predicate: (next: HostSnapshot) => T | null, timeoutMs = 20000, intervalMs = 500): Promise<T> {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const next = readSnapshot();
    snapshot.value = next;
    const result = predicate(next);
    if (result) return result;
    await sleep(intervalMs);
  }
  throw new Error('等待设备响应超时');
}

async function waitForReply(method: string, ids: { tid?: string; bid?: string }, sinceTime: number, timeoutMs = 20000): Promise<TimelineRow> {
  return waitFor((next) => {
    for (let i = next.messages.length - 1; i >= 0; i -= 1) {
      const row = next.messages[i];
      if (row.time < sinceTime) continue;
      const meta = cloudMeta(row);
      if (!meta || !meta.isReply || meta.method !== method) continue;
      if (ids.tid && meta.tid !== ids.tid) continue;
      if (ids.bid && meta.bid !== ids.bid) continue;
      const body = parseRowBody(row);
      const data = body && typeof body.data === 'object' ? body.data : {};
      if (typeof data.result === 'number' && data.result !== 0) {
        throw new Error(`${method} 返回 result=${data.result}`);
      }
      return row;
    }
    return null;
  }, timeoutMs);
}

async function waitForServiceAck(method: string, ids: { tid?: string; bid?: string }, sinceTime: number, timeoutMs = 20000): Promise<TimelineRow> {
  return waitFor((next) => {
    for (let i = next.messages.length - 1; i >= 0; i -= 1) {
      const row = next.messages[i];
      if (row.time < sinceTime) continue;
      const meta = cloudMeta(row);
      if (!meta || !meta.isReply || meta.method !== method) continue;
      if (ids.tid && meta.tid !== ids.tid) continue;
      if (ids.bid && meta.bid !== ids.bid) continue;
      const status = serviceStatusOf(row);
      if (status === 'ok') return row;
      if (status && !['sent', 'in_progress'].includes(status)) {
        throw new Error(`${method} 返回 ${status}`);
      }
    }
    return null;
  }, timeoutMs);
}

async function waitForAirportOnline(airportSn: string, sinceTime: number, timeoutMs = 90000): Promise<TimelineRow> {
  return waitFor((next) => {
    for (let i = next.messages.length - 1; i >= 0; i -= 1) {
      const row = next.messages[i];
      if (row.time < sinceTime) continue;
      const meta = cloudMeta(row);
      if (meta && meta.topicKind === 'osd' && meta.airportSn === airportSn) return row;
    }
    return null;
  }, timeoutMs, 1000);
}

async function publishService(method: string, airportSn: string, data?: Record<string, unknown>): Promise<{ time: number; ids: { tid: string; bid: string } }> {
  if (!bridge || typeof bridge.publish !== 'function') throw new Error('宿主发布能力不可用');
  const time = Date.now();
  const ids = {
    tid: crypto.randomUUID ? crypto.randomUUID() : String(time),
    bid: crypto.randomUUID ? crypto.randomUUID() : String(time + 1)
  };
  const body: Record<string, unknown> = {
    tid: ids.tid,
    bid: ids.bid,
    timestamp: time,
    method
  };
  if (data && Object.keys(data).length) body.data = data;
  const topic = `thing/product/${airportSn}/services`;
  const payload = JSON.stringify(body);
  const result = await bridge.publish({ topic, payload, qos: 1, retain: false });
  if (!result || !result.success) throw new Error(result?.message || `${method} 发布失败`);
  selectedHistoryKey.value = historyKey({ topic, payload, time: result.time || time });
  refreshSnapshot();
  return { time: result.time || time, ids };
}

function latestOsdStatus(type: 'airport' | 'drone', sn: string): { state: 'online' | 'offline' | 'unknown'; text: string; time: number } {
  if (!sn || sn === 'all') {
    return {
      state: 'unknown',
      text: type === 'airport' ? '机场未选择' : '无人机未选择',
      time: 0
    };
  }
  const now = Date.now();
  const recent = cloudMessages.value.find((row) => {
    const meta = cloudMeta(row);
    if (!meta || meta.topicKind !== 'osd') return false;
    return type === 'airport' ? meta.airportSn === sn : meta.droneSn === sn;
  });
  if (!recent) return { state: 'offline', text: `${sn} 无 OSD`, time: 0 };
  const age = now - recent.time;
  if (age <= 30_000) return { state: 'online', text: `${sn} 在线`, time: recent.time };
  return { state: 'offline', text: `${sn} 离线`, time: recent.time };
}

const currentConnection = computed(() => {
  return snapshot.value.connections.find((item) => item.id === snapshot.value.selectedConnectionId) || null;
});

const cloudMessages = computed(() => {
  return [...snapshot.value.messages]
    .filter((row) => !!cloudMeta(row))
    .sort((a, b) => b.time - a.time);
});

const publishEntries = computed<PublishEntry[]>(() => {
  return [...snapshot.value.publishHistory]
    .sort((a, b) => b.time - a.time)
    .map((item) => ({
      key: historyKey(item),
      item,
      meta: parsePublishMeta(item)
    }));
});

const airportOptions = computed(() => {
  const airportSet = new Set<string>();
  const droneScores = new Map<string, number>();
  const airportScores = new Map<string, number>();
  const bump = (map: Map<string, number>, key?: string, step = 1) => {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + step);
  };

  publishEntries.value.forEach((entry) => {
    if (entry.meta.airportSn) {
      airportSet.add(entry.meta.airportSn);
      bump(airportScores, entry.meta.airportSn, 1);
    }
    bump(droneScores, entry.meta.droneSn, 1);
  });

  cloudMessages.value.forEach((row) => {
    const meta = cloudMeta(row);
    if (!meta) return;
    if (meta.airportSn) {
      airportSet.add(meta.airportSn);
      bump(airportScores, meta.airportSn, 3);
    }
    bump(droneScores, meta.droneSn, 3);
  });

  [...(snapshot.value.paramSuggestions.airportSn || []), ...(snapshot.value.paramSuggestions.gateway || [])].forEach((value) => {
    if (!value) return;
    airportSet.add(value);
    bump(airportScores, value, 2);
  });

  return [...airportSet]
    .filter((value) => (airportScores.get(value) || 0) >= (droneScores.get(value) || 0))
    .sort();
});

const allDroneOptions = computed(() => {
  const out = new Set<string>();
  publishEntries.value.forEach((entry) => {
    if (entry.meta.droneSn) out.add(entry.meta.droneSn);
  });
  cloudMessages.value.forEach((row) => {
    const meta = cloudMeta(row);
    if (meta?.droneSn) out.add(meta.droneSn);
  });
  (snapshot.value.paramSuggestions.droneSn || []).forEach((value) => {
    if (value) out.add(value);
  });
  return [...out].sort();
});

const visibleDroneOptions = computed(() => {
  if (airport.value === 'all') return allDroneOptions.value;
  return allDroneOptions.value.filter((item) => {
    return publishEntries.value.some((entry) => entry.meta.airportSn === airport.value && entry.meta.droneSn === item)
      || cloudMessages.value.some((row) => {
        const meta = cloudMeta(row);
        return meta?.airportSn === airport.value && meta.droneSn === item;
      });
  });
});

watch(airportOptions, (options) => {
  if (airport.value !== 'all' && !options.includes(airport.value)) airport.value = 'all';
}, { immediate: true });

watch(visibleDroneOptions, (options) => {
  if (drone.value !== 'all' && !options.includes(drone.value)) drone.value = 'all';
}, { immediate: true });

const filteredHistory = computed(() => {
  return publishEntries.value
    .filter((entry) => {
      if (airport.value !== 'all' && entry.meta.airportSn !== airport.value) return false;
      if (drone.value !== 'all' && entry.meta.droneSn !== drone.value) return false;
      return true;
    })
    .slice(0, 5);
});

watch(filteredHistory, (entries) => {
  if (!entries.some((entry) => entry.key === selectedHistoryKey.value)) {
    selectedHistoryKey.value = entries[0]?.key ?? null;
  }
}, { immediate: true });

const selectedEntry = computed(() => {
  return filteredHistory.value.find((entry) => entry.key === selectedHistoryKey.value) || null;
});

const relatedRows = computed(() => {
  if (!selectedEntry.value) return [] as TimelineRow[];
  return [...cloudMessages.value]
    .filter((row) => {
      const meta = cloudMeta(row);
      if (!meta || row.time < selectedEntry.value!.item.time) return false;
      if (selectedEntry.value!.meta.tid && meta.tid === selectedEntry.value!.meta.tid) return true;
      if (selectedEntry.value!.meta.bid && meta.bid === selectedEntry.value!.meta.bid) return true;
      if (selectedEntry.value!.meta.seq != null && meta.seq === selectedEntry.value!.meta.seq) return true;
      return false;
    })
    .sort((a, b) => a.time - b.time);
});

const callbackRows = computed(() => {
  return relatedRows.value.filter((row) => !!cloudMeta(row)?.isReply);
});

const debugStatus = computed(() => {
  const row = cloudMessages.value.find((item) => !!cloudMeta(item)?.debugState);
  const meta = row ? cloudMeta(row) : null;
  return {
    state: meta?.debugState || 'unknown',
    time: row?.time || 0,
    method: meta?.method || '',
    modeCode: typeof meta?.modeCode === 'number' ? meta.modeCode : null
  };
});

const statusMetaBits = computed(() => {
  const bits: string[] = [];
  if (debugStatus.value.modeCode != null) bits.push(`mode_code=${debugStatus.value.modeCode}`);
  if (debugStatus.value.method) bits.push(debugStatus.value.method);
  if (debugStatus.value.time) bits.push(timeText(debugStatus.value.time));
  return bits;
});

const airportOnline = computed(() => latestOsdStatus('airport', airport.value));
const droneOnline = computed(() => latestOsdStatus('drone', drone.value));

const canOperate = computed(() => {
  return !!snapshot.value.selectedConnectionId && snapshot.value.selectedConnectionState === 'connected' && airport.value !== 'all' && !actionBusy.value;
});

const debugToggleLabel = computed(() => {
  if (actionBusy.value) return '处理中...';
  return debugStatus.value.state === 'enabled' ? '关闭 Debug' : '开启 Debug';
});

const filteredLogRows = computed(() => {
  const start = parseDateInput(logStartTime.value, 0);
  const end = parseDateInput(logEndTime.value, Number.MAX_SAFE_INTEGER);
  const modules = new Set(selectedModules());
  return logEntries.value.filter((item) => {
    if (modules.size && !modules.has(item.module)) return false;
    if (start && item.endTime < start) return false;
    if (end && item.startTime > end) return false;
    if (drone.value !== 'all' && item.deviceSn !== drone.value) return false;
    return true;
  });
});

const selectedLogCount = computed(() => {
  return filteredLogRows.value.filter((item) => selectedLogKeys.value[logEntryKey(item)]).length;
});

const rawLogBytes = computed(() => logEntries.value.reduce((sum, item) => sum + item.size, 0));
const filteredLogBytes = computed(() => filteredLogRows.value.reduce((sum, item) => sum + item.size, 0));

const uploadProgressRows = computed<UploadProgressRow[]>(() => {
  const latest = new Map<string, UploadProgressRow>();
  cloudMessages.value.forEach((row) => {
    const meta = cloudMeta(row);
    if (!meta || meta.method !== 'fileupload_progress') return;
    if (airport.value !== 'all' && meta.airportSn !== airport.value) return;
    const body = parseRowBody(row);
    const files = body?.data?.output?.ext?.files;
    if (!Array.isArray(files)) return;
    files.forEach((file: any) => {
      const key = String(file.key || `${file.module}:${file.device_sn}`);
      if (latest.has(key)) return;
      latest.set(key, {
        key: String(file.key || ''),
        module: String(file.module || ''),
        deviceSn: String(file.device_sn || ''),
        size: Number(file.size || 0),
        fingerprint: String(file.fingerprint || ''),
        progress: Number(file.progress?.progress || 0),
        uploadRate: Number(file.progress?.upload_rate || 0),
        finishTime: Number(file.progress?.finish_time || 0),
        status: String(file.progress?.status || ''),
        result: Number(file.progress?.result || 0),
        time: row.time
      });
    });
  });
  return [...latest.values()];
});

function buildObjectKey(profile: OssProfile, entry: LogEntry, groupedEntries: LogEntry[]): string {
  const prefix = profile.keyPrefix ? profile.keyPrefix.replace(/\/+$/g, '') : `dock-logs/${airport.value}`;
  const rangeStart = timeText(groupedEntries[groupedEntries.length - 1].startTime).replace(/[:\s]/g, '-');
  const rangeEnd = timeText(groupedEntries[0].endTime).replace(/[:\s]/g, '-');
  return `${prefix}/${entry.deviceSn || airport.value}/module-${entry.module}-${rangeStart}-${rangeEnd}.log`;
}

async function runAction(task: () => Promise<void>): Promise<void> {
  actionBusy.value = true;
  try {
    await task();
  } catch (error) {
    console.error(error);
    setFeedback((error as Error).message || '操作失败', 'error');
  } finally {
    actionBusy.value = false;
    refreshSnapshot();
  }
}

async function toggleDebug(): Promise<void> {
  if (airport.value === 'all') throw new Error('请先选择机场');
  const method = debugStatus.value.state === 'enabled' ? 'debug_mode_close' : 'debug_mode_open';
  const sent = await publishService(method, airport.value);
  await waitForServiceAck(method, sent.ids, sent.time);
  setFeedback(`${method} 已发送`);
}

async function restartBootstrap(): Promise<void> {
  if (airport.value === 'all') throw new Error('请先选择机场');
  const openDebug = await publishService('debug_mode_open', airport.value);
  await waitForServiceAck('debug_mode_open', openDebug.ids, openDebug.time);

  const droneOpen = await publishService('drone_open', airport.value);
  await waitForServiceAck('drone_open', droneOpen.ids, droneOpen.time, 30000);

  const reboot = await publishService('device_reboot', airport.value);
  await waitForServiceAck('device_reboot', reboot.ids, reboot.time, 30000);
  await waitForAirportOnline(airport.value, reboot.time, 120000);

  const closeDebug = await publishService('debug_mode_close', airport.value);
  await waitForServiceAck('debug_mode_close', closeDebug.ids, closeDebug.time, 30000);
  setFeedback('重启注册上线流程已完成');
}

async function queryDeviceLogs(): Promise<void> {
  if (airport.value === 'all') throw new Error('请先选择机场');
  const modules = selectedModules();
  if (!modules.length) throw new Error('至少选择一个日志模块');
  const sent = await publishService('fileupload_list', airport.value, { module_list: modules });
  const reply = await waitForReply('fileupload_list', sent.ids, sent.time, 30000);
  logEntries.value = flattenLogEntries(parseRowBody(reply));
  selectedLogKeys.value = {};
  const range = logTimeRange(logEntries.value);
  if (range) {
    logStartTime.value = formatDateInput(range.min);
    logEndTime.value = formatDateInput(range.max);
  }
  setFeedback(`已获取 ${logEntries.value.length} 条可上传日志`);
}

function selectAllLogs(): void {
  const next = { ...selectedLogKeys.value };
  filteredLogRows.value.forEach((item) => {
    next[logEntryKey(item)] = true;
  });
  selectedLogKeys.value = next;
}

function clearLogSelection(): void {
  selectedLogKeys.value = {};
}

function setLogSelected(entry: LogEntry, checked: boolean): void {
  selectedLogKeys.value = {
    ...selectedLogKeys.value,
    [logEntryKey(entry)]: checked
  };
}

async function startFileUpload(): Promise<void> {
  if (airport.value === 'all') throw new Error('请先选择机场');
  const selected = logEntries.value.filter((item) => selectedLogKeys.value[logEntryKey(item)]);
  if (!selected.length) throw new Error('请先选择要上传的日志');
  const profile = activeOssProfile.value;
  if (!profile) throw new Error('OSS 配置不可用');
  const required = ['bucket', 'region', 'endpoint', 'access_key_id', 'access_key_secret', 'expire'] as const;
  for (const key of required) {
    if (!String(profile[key] || '').trim()) throw new Error(`缺少 OSS 字段: ${key}`);
  }

  const grouped = new Map<string, LogEntry[]>();
  selected.forEach((item) => {
    const key = `${item.module}:${item.deviceSn}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(item);
  });

  const files = [...grouped.values()].map((items) => ({
    object_key: buildObjectKey(profile, items[0], items),
    module: String(items[0].module),
    list: items.map((item) => ({ boot_index: item.bootIndex }))
  }));

  const payload = {
    bucket: profile.bucket,
    region: profile.region,
    endpoint: profile.endpoint,
    provider: profile.provider,
    credentials: {
      access_key_id: profile.access_key_id,
      access_key_secret: profile.access_key_secret,
      expire: Number(profile.expire),
      security_token: profile.security_token
    },
    params: { files }
  };

  const sent = await publishService('fileupload_start', airport.value, payload);
  await waitForReply('fileupload_start', sent.ids, sent.time, 30000);
  uploadRequest.value = {
    time: sent.time,
    modules: [...new Set(selected.map((item) => item.module))]
  };
  setFeedback('日志上传任务已发起');
}

async function cancelFileUpload(): Promise<void> {
  if (airport.value === 'all') throw new Error('请先选择机场');
  const moduleList = [...new Set(uploadProgressRows.value.map((item) => item.module).filter(Boolean))];
  if (!moduleList.length) throw new Error('当前没有可取消的上传任务');
  const sent = await publishService('fileupload_update', airport.value, {
    status: 'cancel',
    module_list: moduleList
  });
  await waitForReply('fileupload_update', sent.ids, sent.time, 30000);
  setFeedback('已发送取消上传指令');
}

onMounted(() => {
  loadOssProfiles();
  loadActiveProfileIntoForm();
  logStartTime.value = formatDateInput(Date.now() - 24 * 60 * 60 * 1000);
  logEndTime.value = formatDateInput(Date.now());
  refreshSnapshot();
  refreshTimer = window.setInterval(refreshSnapshot, 1200);
});

onBeforeUnmount(() => {
  if (refreshTimer != null) window.clearInterval(refreshTimer);
});
</script>

<template>
  <div class="page">
    <div class="topbar">
      <div class="badge">
        {{ currentConnection ? `${currentConnection.name} / ${currentConnection.state}` : '连接未选择' }}
      </div>
      <div class="status-pill" :class="debugStatus.state === 'enabled' ? 'enabled' : debugStatus.state === 'disabled' ? 'disabled' : ''">
        {{ `Debug ${debugStatus.state === 'enabled' ? '已开启' : debugStatus.state === 'disabled' ? '已关闭' : '未识别'}` }}
      </div>
      <div class="badge" :class="airportOnline.state">
        {{ `机场 ${airportOnline.text}${airportOnline.time ? ` / ${shortTime(airportOnline.time)}` : ''}` }}
      </div>
      <div class="badge" :class="droneOnline.state">
        {{ `无人机 ${droneOnline.text}${droneOnline.time ? ` / ${shortTime(droneOnline.time)}` : ''}` }}
      </div>
      <div class="badge">
        {{ `${filteredHistory.length} 条发送 / ${callbackRows.length} 条回调` }}
      </div>
    </div>

    <div v-if="feedback" class="notice" :class="feedbackTone">
      {{ feedback }}
    </div>

    <div class="toolbar">
      <label class="field">
        <span>机场</span>
        <select v-model="airport">
          <option value="all">全部机场</option>
          <option v-for="item in airportOptions" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>

      <label class="field">
        <span>无人机</span>
        <select v-model="drone">
          <option value="all">全部无人机</option>
          <option v-for="item in visibleDroneOptions" :key="item" :value="item">{{ item }}</option>
        </select>
      </label>

      <button class="action-button" :disabled="!canOperate" @click="runAction(toggleDebug)">
        {{ debugToggleLabel }}
      </button>

      <button class="action-button secondary" :disabled="!canOperate" @click="runAction(restartBootstrap)">
        {{ actionBusy ? '执行中...' : '重启注册上线' }}
      </button>
    </div>

    <div class="status-card">
      <div class="status-main">
        <div class="status-title">当前 Debug 状态</div>
        <div class="status-value">
          {{ debugStatus.state === 'enabled' ? '已开启' : debugStatus.state === 'disabled' ? '已关闭' : '暂未识别' }}
        </div>
        <div class="status-meta">
          <span v-for="item in statusMetaBits" :key="item">{{ item }}</span>
        </div>
      </div>

      <div class="status-main">
        <div class="status-title">说明</div>
        <div class="mini">插件页面业务已完整收进 Vue 组件，后续继续拆 `components / composables` 会更顺手。</div>
      </div>
    </div>

    <div class="workspace">
      <section class="panel">
        <div class="panel-head">日志查询与选择</div>
        <div class="panel-body">
          <div class="subgrid">
            <label class="field">
              <span>开始时间</span>
              <input v-model="logStartTime" type="datetime-local">
            </label>
            <label class="field">
              <span>结束时间</span>
              <input v-model="logEndTime" type="datetime-local">
            </label>
          </div>

          <div class="field">
            <span>日志模块</span>
            <div class="field-actions">
              <label class="checkline"><input v-model="moduleDrone" type="checkbox">飞行器</label>
              <label class="checkline"><input v-model="moduleDock" type="checkbox">机场</label>
            </div>
          </div>

          <div class="field-actions">
            <button class="action-button" :disabled="!canOperate" @click="runAction(queryDeviceLogs)">查询可上传日志</button>
            <button class="tiny" @click="selectAllLogs">全选筛选结果</button>
            <button class="tiny ghost" @click="clearLogSelection">清空已选</button>
          </div>

          <div class="stat-line">
            <span>{{ `筛选结果 ${filteredLogRows.length} / 原始 ${logEntries.length} 条` }}</span>
            <span>{{ `已选 ${selectedLogCount} 条` }}</span>
            <span>{{ `筛选大小 ${bytesText(filteredLogBytes)}` }}</span>
            <span>{{ `原始大小 ${bytesText(rawLogBytes)}` }}</span>
          </div>

          <div v-if="!filteredLogRows.length" class="empty">
            {{ logEntries.length ? '日志已经查到了，但被当前时间范围、模块或无人机筛选挡住了。' : '先点击“查询可上传日志”，或者调整时间范围后再筛选。' }}
          </div>

          <div v-else class="log-list">
            <label v-for="item in filteredLogRows" :key="logEntryKey(item)" class="log-item" :class="{ active: !!selectedLogKeys[logEntryKey(item)] }">
              <input
                type="checkbox"
                :checked="!!selectedLogKeys[logEntryKey(item)]"
                @change="setLogSelected(item, ($event.target as HTMLInputElement).checked)"
              >
              <div>
                <div class="log-title">
                  <span class="method">{{ moduleLabel(item.module) }}</span>
                  <span class="pill">{{ item.deviceSn || '-' }}</span>
                  <span class="pill">{{ `boot ${item.bootIndex}` }}</span>
                  <span class="pill">{{ bytesText(item.size) }}</span>
                </div>
                <div class="log-meta">
                  <span>{{ `开始 ${timeText(item.startTime)}` }}</span>
                  <span>{{ `结束 ${timeText(item.endTime)}` }}</span>
                  <span>{{ `result ${item.result}` }}</span>
                </div>
              </div>
            </label>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">OSS 配置与上传进度</div>
        <div class="panel-body">
          <div class="subgrid">
            <label class="field">
              <span>配置档案</span>
              <select v-model="activeOssProfileId">
                <option v-for="item in ossProfiles" :key="item.id" :value="item.id">{{ item.name || '未命名配置' }}</option>
              </select>
            </label>
            <label class="field">
              <span>档案名称</span>
              <input v-model="ossForm.name" type="text" placeholder="例如 默认阿里云">
            </label>
          </div>

          <div class="field-actions">
            <button class="tiny" @click="saveCurrentProfile">保存当前配置</button>
            <button class="tiny" @click="createNewProfile">新建配置</button>
            <button class="tiny ghost" @click="deleteCurrentProfile">删除配置</button>
          </div>

          <div class="subgrid">
            <label class="field">
              <span>Provider</span>
              <select v-model="ossForm.provider">
                <option value="ali">ali</option>
                <option value="aws">aws</option>
                <option value="minio">minio</option>
              </select>
            </label>
            <label class="field">
              <span>Region</span>
              <input v-model="ossForm.region" type="text" placeholder="例如 hz">
            </label>
            <label class="field">
              <span>Bucket</span>
              <input v-model="ossForm.bucket" type="text" placeholder="对象存储桶名称">
            </label>
            <label class="field">
              <span>Endpoint</span>
              <input v-model="ossForm.endpoint" type="text" placeholder="https://oss-cn-hangzhou.aliyuncs.com">
            </label>
            <label class="field">
              <span>上传前缀</span>
              <input v-model="ossForm.keyPrefix" type="text" placeholder="例如 dock-logs/prod">
            </label>
            <label class="field">
              <span>Expire</span>
              <input v-model="ossForm.expire" type="number" placeholder="毫秒时间戳">
            </label>
            <label class="field">
              <span>Access Key ID</span>
              <input v-model="ossForm.access_key_id" class="secret" type="text">
            </label>
            <label class="field">
              <span>Access Key Secret</span>
              <input v-model="ossForm.access_key_secret" class="secret" type="password">
            </label>
          </div>

          <label class="field">
            <span>Security Token</span>
            <input v-model="ossForm.security_token" class="secret" type="text">
          </label>

          <div class="field-actions">
            <button class="action-button secondary" :disabled="!canOperate" @click="runAction(startFileUpload)">上传已选日志</button>
            <button class="tiny ghost" :disabled="!canOperate" @click="runAction(cancelFileUpload)">取消上传</button>
          </div>

          <div class="stat-line">
            <span>{{ `配置 ${activeOssProfile?.name || '未命名配置'}` }}</span>
            <span>{{ `进度项 ${uploadProgressRows.length} 条` }}</span>
            <span>{{ uploadRequest ? `最近上传 ${timeText(uploadRequest.time)}` : '最近上传 暂无' }}</span>
          </div>

          <div v-if="!uploadProgressRows.length" class="empty">
            暂无上传进度。发起上传后，这里会自动展示 `fileupload_progress`。
          </div>

          <div v-else class="progress-list">
            <article v-for="item in uploadProgressRows" :key="item.key || `${item.module}:${item.deviceSn}`" class="progress-item">
              <div class="row">
                <span class="method">{{ item.key || item.deviceSn }}</span>
                <span class="pill">{{ moduleLabel(item.module) }}</span>
                <span class="time">{{ item.status || 'unknown' }}</span>
              </div>
              <div class="row mini">
                <span>{{ item.deviceSn || '-' }}</span>
                <span>{{ bytesText(item.size) }}</span>
                <span>{{ item.uploadRate ? `${item.uploadRate} B/s` : '速率未知' }}</span>
                <span>{{ item.finishTime ? `完成 ${timeText(item.finishTime)}` : '未完成' }}</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: `${Math.max(0, Math.min(100, item.progress))}%` }"></div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </div>

    <div class="layout">
      <section class="panel">
        <div class="panel-head">发送历史</div>
        <div class="panel-body">
          <div v-if="!filteredHistory.length" class="empty">当前筛选下没有发送记录。</div>
          <button
            v-for="entry in filteredHistory"
            :key="entry.key"
            type="button"
            class="history-item"
            :class="{ active: entry.key === selectedHistoryKey }"
            @click="selectedHistoryKey = entry.key"
          >
            <div class="row">
              <div class="method">{{ entry.meta.method || entry.item.topic }}</div>
              <div class="time">{{ shortTime(entry.item.time) }}</div>
            </div>
            <div class="row mini">
              <span>{{ `机场 ${entry.meta.airportSn || '-'}` }}</span>
              <span>{{ `无人机 ${entry.meta.droneSn || '-'}` }}</span>
            </div>
            <div class="row mini">
              <span>{{ entry.meta.tid || entry.meta.bid || (entry.meta.seq != null ? `seq ${entry.meta.seq}` : '无 tid/bid') }}</span>
            </div>
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">详情</div>
        <div class="panel-body">
          <div v-if="!selectedEntry" class="empty">请选择一条发送记录。</div>
          <div v-else class="stack">
            <div class="summary-block">
              <div class="row"><span class="mini">方法</span><span class="method">{{ selectedEntry.meta.method || selectedEntry.item.topic }}</span></div>
              <div class="row"><span class="mini">时间</span><span class="method">{{ timeText(selectedEntry.item.time) }}</span></div>
              <div class="row"><span class="mini">标识</span><span class="method">{{ selectedEntry.meta.tid || selectedEntry.meta.bid || (selectedEntry.meta.seq != null ? `seq ${selectedEntry.meta.seq}` : '无 tid/bid') }}</span></div>
            </div>

            <div class="summary-block">
              <div class="row"><span class="mini">关联回调</span></div>
              <div v-if="!callbackRows.length" class="empty">这条记录暂时还没有匹配到回调。</div>
              <div v-else class="stack">
                <article v-for="row in callbackRows" :key="`${row.time}:${row.topic}`" class="message-card">
                  <div class="row">
                    <span class="pill reply">{{ cloudMeta(row)?.topicKind || 'reply' }}</span>
                    <span class="method">{{ cloudMeta(row)?.method || row.topic }}</span>
                    <span class="time">{{ timeText(row.time) }}</span>
                  </div>
                  <div class="row mini">
                    <span v-if="cloudMeta(row)?.tid">{{ `tid ${cloudMeta(row)?.tid}` }}</span>
                    <span v-if="cloudMeta(row)?.bid">{{ `bid ${cloudMeta(row)?.bid}` }}</span>
                  </div>
                  <pre>{{ row.payload }}</pre>
                </article>
              </div>
            </div>

            <div class="summary-block">
              <div class="row"><span class="mini">关联链路消息</span></div>
              <div v-if="!relatedRows.length" class="empty">没有找到关联链路消息。</div>
              <div v-else class="stack">
                <article v-for="row in relatedRows" :key="`${row.time}:${row.topic}:related`" class="message-card">
                  <div class="row">
                    <span class="pill" :class="{ reply: !!cloudMeta(row)?.isReply }">{{ cloudMeta(row)?.topicKind || '' }}</span>
                    <span class="method">{{ cloudMeta(row)?.method || row.topic }}</span>
                    <span class="time">{{ timeText(row.time) }}</span>
                  </div>
                  <div class="row mini">
                    <span>{{ `机场 ${cloudMeta(row)?.airportSn || '-'}` }}</span>
                    <span>{{ `无人机 ${cloudMeta(row)?.droneSn || '-'}` }}</span>
                    <span v-if="cloudMeta(row)?.tid">{{ `tid ${cloudMeta(row)?.tid}` }}</span>
                    <span v-if="cloudMeta(row)?.bid">{{ `bid ${cloudMeta(row)?.bid}` }}</span>
                  </div>
                  <pre>{{ row.payload }}</pre>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style>
:root {
  color-scheme: dark;
  --bg: #0b1220;
  --panel: rgba(15, 23, 42, 0.88);
  --panel-soft: rgba(30, 41, 59, 0.82);
  --line: rgba(148, 163, 184, 0.18);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --good: #34d399;
  --bad: #f87171;
  --accent: #38bdf8;
  --warn: #fbbf24;
  font-family: "Microsoft YaHei UI", "PingFang SC", sans-serif;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 28%),
    radial-gradient(circle at top left, rgba(52, 211, 153, 0.08), transparent 25%),
    linear-gradient(180deg, #0b1220, #111827 60%, #0f172a);
  color: var(--text);
}

body {
  padding: 16px;
}

button,
input,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: calc(100vh - 32px);
}

.topbar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.badge,
.status-pill,
.notice {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.78);
  border: 1px solid var(--line);
  color: var(--muted);
}

.badge.online {
  color: var(--good);
  border-color: rgba(52, 211, 153, 0.28);
  background: rgba(52, 211, 153, 0.12);
}

.badge.offline {
  color: var(--bad);
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(248, 113, 113, 0.1);
}

.badge.unknown {
  color: var(--warn);
  border-color: rgba(251, 191, 36, 0.26);
  background: rgba(251, 191, 36, 0.1);
}

.status-pill.enabled,
.notice.info {
  color: var(--good);
  border-color: rgba(52, 211, 153, 0.28);
  background: rgba(52, 211, 153, 0.12);
}

.status-pill.disabled,
.notice.error {
  color: var(--bad);
  border-color: rgba(248, 113, 113, 0.26);
  background: rgba(248, 113, 113, 0.1);
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(180px, 240px) minmax(180px, 220px) minmax(180px, 220px);
  gap: 12px;
  align-items: end;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 12px;
  color: var(--muted);
}

select,
input,
.action-button {
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text);
  padding: 0 12px;
}

.action-button {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(14, 165, 233, 0.16));
  color: #e0f2fe;
  font-weight: 700;
}

.action-button.secondary {
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.12));
  color: #d1fae5;
}

.action-button[disabled],
.tiny[disabled] {
  cursor: not-allowed;
  opacity: 0.5;
}

.status-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.9));
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 16px 18px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.status-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-title {
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.status-value {
  font-size: 28px;
  font-weight: 800;
}

.status-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 12px;
  font-family: Consolas, monospace;
}

.workspace {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 14px;
}

.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 14px;
}

.panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.panel-head {
  padding: 12px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item,
.message-card,
.summary-block {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 12px;
  background: var(--panel-soft);
  user-select: text;
}

.history-item {
  width: 100%;
  text-align: left;
  appearance: none;
}

.history-item.active,
.log-item.active {
  border-color: rgba(56, 189, 248, 0.42);
  box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.2) inset;
}

.row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.row + .row {
  margin-top: 8px;
}

.method {
  font-weight: 700;
  color: #f8fafc;
}

.time {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
  font-family: Consolas, monospace;
}

.mini {
  color: var(--muted);
  font-size: 12px;
}

.pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--line);
  font-size: 11px;
  color: var(--muted);
}

.pill.reply {
  color: var(--good);
  border-color: rgba(52, 211, 153, 0.26);
  background: rgba(52, 211, 153, 0.12);
}

pre {
  margin: 8px 0 0;
  padding: 12px;
  border-radius: 12px;
  background: rgba(2, 6, 23, 0.56);
  white-space: pre-wrap;
  word-break: break-all;
  overflow: auto;
  line-height: 1.55;
  font-family: Consolas, "JetBrains Mono", monospace;
  font-size: 12px;
  color: #cbd5e1;
}

.empty {
  color: var(--muted);
  padding: 24px;
  text-align: center;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.subgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.checkline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  min-height: 40px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text);
}

.checkline input,
.log-item input {
  accent-color: var(--accent);
}

.tiny {
  min-height: 34px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.72);
  color: var(--text);
}

.tiny.ghost {
  background: transparent;
}

.stat-line {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  color: var(--muted);
  font-size: 12px;
}

.log-list,
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.log-item {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--panel-soft);
  padding: 12px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: start;
}

.log-title,
.log-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.log-meta {
  color: var(--muted);
  font-size: 12px;
  margin-top: 6px;
}

.progress-item {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--panel-soft);
  padding: 12px;
}

.progress-bar {
  width: 100%;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid var(--line);
  margin-top: 10px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8, #34d399);
}

.secret {
  font-family: Consolas, "JetBrains Mono", monospace;
}

@media (max-width: 980px) {
  body {
    padding: 12px;
  }

  .toolbar,
  .workspace,
  .layout,
  .subgrid {
    grid-template-columns: 1fr;
  }
}
</style>
