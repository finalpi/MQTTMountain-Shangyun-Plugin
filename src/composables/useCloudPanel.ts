import { computed, reactive, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import type {
  CloudMeta,
  HostSnapshot,
  LogEntry,
  OssProfile,
  PublishEntry,
  PublishHistoryRow,
  PublishMeta,
  TimelineRow,
  UploadProgressRow
} from '../types/panel';
import {
  bytesText,
  emptyOssProfile,
  emptySnapshot,
  formatDateInput,
  moduleLabel,
  parseDateInput,
  safeParse,
  shortTime,
  timeText,
  toMs
} from '../utils/panelFormat';

const OSS_STORAGE_KEY = 'mm.plugin.dji.oss-profiles.v1';

export function useCloudPanel() {
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

  function setFeedback(text: string, tone: 'info' | 'error' = 'info'): void {
    feedback.value = text;
    feedbackTone.value = tone;
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
      return { state: 'unknown', text: type === 'airport' ? '机场未选择' : '无人机未选择', time: 0 };
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

  const currentConnection = computed(() => snapshot.value.connections.find((item) => item.id === snapshot.value.selectedConnectionId) || null);
  const cloudMessages = computed(() => [...snapshot.value.messages].filter((row) => !!cloudMeta(row)).sort((a, b) => b.time - a.time));
  const publishEntries = computed<PublishEntry[]>(() => [...snapshot.value.publishHistory].sort((a, b) => b.time - a.time).map((item) => ({ key: historyKey(item), item, meta: parsePublishMeta(item) })));

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

    return [...airportSet].filter((value) => (airportScores.get(value) || 0) >= (droneScores.get(value) || 0)).sort();
  });

  const allDroneOptions = computed(() => {
    const out = new Set<string>();
    publishEntries.value.forEach((entry) => { if (entry.meta.droneSn) out.add(entry.meta.droneSn); });
    cloudMessages.value.forEach((row) => { const meta = cloudMeta(row); if (meta?.droneSn) out.add(meta.droneSn); });
    (snapshot.value.paramSuggestions.droneSn || []).forEach((value) => { if (value) out.add(value); });
    return [...out].sort();
  });

  const visibleDroneOptions = computed(() => {
    if (airport.value === 'all') return allDroneOptions.value;
    return allDroneOptions.value.filter((item) => publishEntries.value.some((entry) => entry.meta.airportSn === airport.value && entry.meta.droneSn === item) || cloudMessages.value.some((row) => {
      const meta = cloudMeta(row);
      return meta?.airportSn === airport.value && meta.droneSn === item;
    }));
  });

  watch(airportOptions, (options) => {
    if (airport.value !== 'all' && !options.includes(airport.value)) airport.value = 'all';
  }, { immediate: true });

  watch(visibleDroneOptions, (options) => {
    if (drone.value !== 'all' && !options.includes(drone.value)) drone.value = 'all';
  }, { immediate: true });

  const filteredHistory = computed(() => publishEntries.value.filter((entry) => {
    if (airport.value !== 'all' && entry.meta.airportSn !== airport.value) return false;
    if (drone.value !== 'all' && entry.meta.droneSn !== drone.value) return false;
    return true;
  }).slice(0, 5));

  watch(filteredHistory, (entries) => {
    if (!entries.some((entry) => entry.key === selectedHistoryKey.value)) {
      selectedHistoryKey.value = entries[0]?.key ?? null;
    }
  }, { immediate: true });

  const selectedEntry = computed(() => filteredHistory.value.find((entry) => entry.key === selectedHistoryKey.value) || null);
  const relatedRows = computed(() => {
    if (!selectedEntry.value) return [] as TimelineRow[];
    return [...cloudMessages.value].filter((row) => {
      const meta = cloudMeta(row);
      if (!meta || row.time < selectedEntry.value!.item.time) return false;
      if (selectedEntry.value!.meta.tid && meta.tid === selectedEntry.value!.meta.tid) return true;
      if (selectedEntry.value!.meta.bid && meta.bid === selectedEntry.value!.meta.bid) return true;
      if (selectedEntry.value!.meta.seq != null && meta.seq === selectedEntry.value!.meta.seq) return true;
      return false;
    }).sort((a, b) => a.time - b.time);
  });

  const callbackRows = computed(() => relatedRows.value.filter((row) => !!cloudMeta(row)?.isReply));
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
  const canOperate = computed(() => !!snapshot.value.selectedConnectionId && snapshot.value.selectedConnectionState === 'connected' && airport.value !== 'all' && !actionBusy.value);
  const debugToggleLabel = computed(() => actionBusy.value ? '处理中...' : debugStatus.value.state === 'enabled' ? '关闭 Debug' : '开启 Debug');

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

  const selectedLogCount = computed(() => filteredLogRows.value.filter((item) => selectedLogKeys.value[logEntryKey(item)]).length);
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
    selectedLogKeys.value = { ...selectedLogKeys.value, [logEntryKey(entry)]: checked };
  }

  async function startFileUpload(): Promise<void> {
    if (airport.value === 'all') throw new Error('请先选择机场');
    const selected = logEntries.value.filter((item) => selectedLogKeys.value[logEntryKey(item)]);
    if (!selected.length) throw new Error('请先选择要上传的日志');
    const profile = activeOssProfile.value;
    if (!profile) throw new Error('OSS 配置不可用');
    const required = ['bucket', 'region', 'endpoint', 'access_key_id', 'access_key_secret'] as const;
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
    const credentials: Record<string, string | number> = {
      access_key_id: profile.access_key_id,
      access_key_secret: profile.access_key_secret
    };
    const expireValue = String(profile.expire || '').trim();
    if (expireValue) credentials.expire = Number(expireValue);
    const securityToken = String(profile.security_token || '').trim();
    if (securityToken) credentials.security_token = securityToken;

    const payload = {
      bucket: profile.bucket,
      region: profile.region,
      endpoint: profile.endpoint,
      provider: profile.provider,
      credentials,
      params: { files }
    };
    const sent = await publishService('fileupload_start', airport.value, payload);
    await waitForReply('fileupload_start', sent.ids, sent.time, 30000);
    uploadRequest.value = { time: sent.time, modules: [...new Set(selected.map((item) => item.module))] };
    setFeedback('日志上传任务已发起');
  }

  async function cancelFileUpload(): Promise<void> {
    if (airport.value === 'all') throw new Error('请先选择机场');
    const moduleList = [...new Set(uploadProgressRows.value.map((item) => item.module).filter(Boolean))];
    if (!moduleList.length) throw new Error('当前没有可取消的上传任务');
    const sent = await publishService('fileupload_update', airport.value, { status: 'cancel', module_list: moduleList });
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

  return {
    airport,
    drone,
    selectedHistoryKey,
    actionBusy,
    feedback,
    feedbackTone,
    logEntries,
    selectedLogKeys,
    uploadRequest,
    logStartTime,
    logEndTime,
    moduleDrone,
    moduleDock,
    ossProfiles,
    activeOssProfileId,
    ossForm,
    snapshot,
    currentConnection,
    airportOptions,
    visibleDroneOptions,
    filteredHistory,
    callbackRows,
    relatedRows,
    selectedEntry,
    debugStatus,
    statusMetaBits,
    airportOnline,
    droneOnline,
    canOperate,
    debugToggleLabel,
    filteredLogRows,
    selectedLogCount,
    rawLogBytes,
    filteredLogBytes,
    uploadProgressRows,
    activeOssProfile,
    bytesText,
    timeText,
    shortTime,
    moduleLabel,
    logEntryKey,
    cloudMeta,
    runAction,
    toggleDebug,
    restartBootstrap,
    queryDeviceLogs,
    selectAllLogs,
    clearLogSelection,
    setLogSelected,
    startFileUpload,
    cancelFileUpload,
    createNewProfile,
    deleteCurrentProfile,
    saveCurrentProfile
  };
}
