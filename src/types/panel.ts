export interface HostConnection {
  id: string;
  name: string;
  state: string;
}

export interface CloudMeta {
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

export interface TimelineRow {
  time: number;
  topic: string;
  payload: string;
  decoded?: { meta?: CloudMeta } | null;
}

export interface PublishHistoryRow {
  topic: string;
  payload: string;
  qos: number;
  retain: boolean;
  time: number;
}

export interface HostSnapshot {
  selectedConnectionId: string | null;
  selectedConnectionState: string;
  connections: HostConnection[];
  messages: TimelineRow[];
  publishHistory: PublishHistoryRow[];
  paramSuggestions: Record<string, string[]>;
}

export interface PublishMeta {
  airportSn?: string;
  droneSn?: string;
  tid?: string;
  bid?: string;
  seq?: number;
  method?: string;
}

export interface PublishEntry {
  key: string;
  item: PublishHistoryRow;
  meta: PublishMeta;
}

export interface LogEntry {
  module: string;
  deviceSn: string;
  bootIndex: number;
  startTime: number;
  endTime: number;
  size: number;
  result: number;
}

export interface OssProfile {
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

export interface UploadProgressRow {
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
