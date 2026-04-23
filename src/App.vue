<script setup lang="ts">
import type { OssProfile } from './types/panel';
import PanelHeader from './components/PanelHeader.vue';
import LogWorkspace from './components/LogWorkspace.vue';
import HistoryWorkspace from './components/HistoryWorkspace.vue';
import { useCloudPanel } from './composables/useCloudPanel';

const panel = useCloudPanel();
const {
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
} = panel;

function updateOssField(field: keyof OssProfile, value: string): void {
  ossForm[field] = value as never;
}
</script>

<template>
  <div class="page">
    <PanelHeader
      :current-connection="currentConnection"
      :debug-state="debugStatus.state"
      :airport-online="airportOnline"
      :drone-online="droneOnline"
      :filtered-history-count="filteredHistory.length"
      :callback-count="callbackRows.length"
      :feedback="feedback"
      :feedback-tone="feedbackTone"
      :airport="airport"
      :drone="drone"
      :airport-options="airportOptions"
      :drone-options="visibleDroneOptions"
      :can-operate="canOperate"
      :debug-toggle-label="debugToggleLabel"
      :action-busy="actionBusy"
      :status-text="debugStatus.state === 'enabled' ? '已开启' : debugStatus.state === 'disabled' ? '已关闭' : '暂未识别'"
      :status-meta-bits="statusMetaBits"
      :short-time="shortTime"
      @update:airport="airport = $event"
      @update:drone="drone = $event"
      @toggle-debug="runAction(toggleDebug)"
      @restart-bootstrap="runAction(restartBootstrap)"
    />

    <LogWorkspace
      :can-operate="canOperate"
      :log-start-time="logStartTime"
      :log-end-time="logEndTime"
      :module-drone="moduleDrone"
      :module-dock="moduleDock"
      :filtered-log-rows="filteredLogRows"
      :log-entries="logEntries"
      :selected-log-keys="selectedLogKeys"
      :selected-log-count="selectedLogCount"
      :raw-log-bytes="rawLogBytes"
      :filtered-log-bytes="filteredLogBytes"
      :upload-progress-rows="uploadProgressRows"
      :upload-request="uploadRequest"
      :oss-profiles="ossProfiles"
      :active-oss-profile-id="activeOssProfileId"
      :oss-form="ossForm"
      :bytes-text="bytesText"
      :time-text="timeText"
      :module-label="moduleLabel"
      :log-entry-key="logEntryKey"
      @update:log-start-time="logStartTime = $event"
      @update:log-end-time="logEndTime = $event"
      @update:module-drone="moduleDrone = $event"
      @update:module-dock="moduleDock = $event"
      @update:active-oss-profile-id="activeOssProfileId = $event"
      @update:oss-field="updateOssField"
      @query-logs="runAction(queryDeviceLogs)"
      @select-all-logs="selectAllLogs"
      @clear-log-selection="clearLogSelection"
      @set-log-selected="setLogSelected"
      @upload-selected="runAction(startFileUpload)"
      @cancel-upload="runAction(cancelFileUpload)"
      @save-current-profile="saveCurrentProfile"
      @create-new-profile="createNewProfile"
      @delete-current-profile="deleteCurrentProfile"
    />

    <HistoryWorkspace
      :filtered-history="filteredHistory"
      :selected-history-key="selectedHistoryKey"
      :selected-entry="selectedEntry"
      :callback-rows="callbackRows"
      :related-rows="relatedRows"
      :short-time="shortTime"
      :time-text="timeText"
      :cloud-meta="cloudMeta"
      @update:selected-history-key="selectedHistoryKey = $event"
    />
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

* { box-sizing: border-box; }
html, body {
  margin: 0;
  min-height: 100%;
  background:
    radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 28%),
    radial-gradient(circle at top left, rgba(52, 211, 153, 0.08), transparent 25%),
    linear-gradient(180deg, #0b1220, #111827 60%, #0f172a);
  color: var(--text);
}
body { padding: 16px; }
button, input, select { font: inherit; }
button { cursor: pointer; }
.page { display: flex; flex-direction: column; gap: 14px; min-height: calc(100vh - 32px); }
.topbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.badge, .status-pill, .notice {
  display: inline-flex; align-items: center; gap: 8px; padding: 7px 12px; border-radius: 999px;
  background: rgba(15, 23, 42, 0.78); border: 1px solid var(--line); color: var(--muted);
}
.badge.online { color: var(--good); border-color: rgba(52, 211, 153, 0.28); background: rgba(52, 211, 153, 0.12); }
.badge.offline { color: var(--bad); border-color: rgba(248, 113, 113, 0.26); background: rgba(248, 113, 113, 0.1); }
.badge.unknown { color: var(--warn); border-color: rgba(251, 191, 36, 0.26); background: rgba(251, 191, 36, 0.1); }
.status-pill.enabled, .notice.info { color: var(--good); border-color: rgba(52, 211, 153, 0.28); background: rgba(52, 211, 153, 0.12); }
.status-pill.disabled, .notice.error { color: var(--bad); border-color: rgba(248, 113, 113, 0.26); background: rgba(248, 113, 113, 0.1); }
.toolbar { display: grid; grid-template-columns: minmax(180px, 240px) minmax(180px, 240px) minmax(180px, 220px) minmax(180px, 220px); gap: 12px; align-items: end; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field span { font-size: 12px; color: var(--muted); }
select, input, .action-button {
  min-height: 40px; border-radius: 12px; border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.72); color: var(--text); padding: 0 12px;
}
.action-button { background: linear-gradient(135deg, rgba(56, 189, 248, 0.24), rgba(14, 165, 233, 0.16)); color: #e0f2fe; font-weight: 700; }
.action-button.secondary { background: linear-gradient(135deg, rgba(52, 211, 153, 0.2), rgba(16, 185, 129, 0.12)); color: #d1fae5; }
.action-button[disabled], .tiny[disabled] { cursor: not-allowed; opacity: 0.5; }
.status-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.92), rgba(15, 23, 42, 0.9));
  border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}
.status-main { display: flex; flex-direction: column; gap: 8px; }
.status-title { color: var(--muted); font-size: 12px; letter-spacing: 0.04em; }
.status-value { font-size: 28px; font-weight: 800; }
.status-meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; font-family: Consolas, monospace; }
.workspace { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 14px; }
.layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 14px; }
.panel {
  min-height: 0; display: flex; flex-direction: column; background: var(--panel);
  border: 1px solid var(--line); border-radius: 18px; overflow: hidden; backdrop-filter: blur(10px);
}
.panel-head {
  padding: 12px 14px; border-bottom: 1px solid var(--line); color: var(--muted);
  font-size: 12px; font-weight: 700; letter-spacing: 0.04em;
}
.panel-body { flex: 1; min-height: 0; overflow: auto; padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.history-item, .message-card, .summary-block {
  border: 1px solid var(--line); border-radius: 14px; padding: 12px; background: var(--panel-soft); user-select: text;
}
.history-item { width: 100%; text-align: left; appearance: none; }
.history-item.active, .log-item.active { border-color: rgba(56, 189, 248, 0.42); box-shadow: 0 0 0 1px rgba(56, 189, 248, 0.2) inset; }
.row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.row + .row { margin-top: 8px; }
.method { font-weight: 700; color: #f8fafc; }
.time { margin-left: auto; color: var(--muted); font-size: 12px; font-family: Consolas, monospace; }
.mini { color: var(--muted); font-size: 12px; }
.pill {
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
  border: 1px solid var(--line); font-size: 11px; color: var(--muted);
}
.pill.reply { color: var(--good); border-color: rgba(52, 211, 153, 0.26); background: rgba(52, 211, 153, 0.12); }
pre {
  margin: 8px 0 0; padding: 12px; border-radius: 12px; background: rgba(2, 6, 23, 0.56);
  white-space: pre-wrap; word-break: break-all; overflow: auto; line-height: 1.55;
  font-family: Consolas, "JetBrains Mono", monospace; font-size: 12px; color: #cbd5e1;
}
.empty { color: var(--muted); padding: 24px; text-align: center; }
.stack { display: flex; flex-direction: column; gap: 12px; }
.subgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.field-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.checkline {
  display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; min-height: 40px;
  border-radius: 12px; border: 1px solid var(--line); background: rgba(15, 23, 42, 0.72); color: var(--text);
}
.checkline input, .log-item input { accent-color: var(--accent); }
.tiny {
  min-height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line);
  background: rgba(15, 23, 42, 0.72); color: var(--text);
}
.tiny.ghost { background: transparent; }
.stat-line { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
.log-list, .progress-list { display: flex; flex-direction: column; gap: 10px; }
.log-item {
  border: 1px solid var(--line); border-radius: 14px; background: var(--panel-soft);
  padding: 12px; display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start;
}
.log-title, .log-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.log-meta { color: var(--muted); font-size: 12px; margin-top: 6px; }
.progress-item { border: 1px solid var(--line); border-radius: 14px; background: var(--panel-soft); padding: 12px; }
.progress-bar {
  width: 100%; height: 10px; border-radius: 999px; overflow: hidden;
  background: rgba(15, 23, 42, 0.7); border: 1px solid var(--line); margin-top: 10px;
}
.progress-fill { height: 100%; background: linear-gradient(90deg, #38bdf8, #34d399); }
.secret { font-family: Consolas, "JetBrains Mono", monospace; }
@media (max-width: 980px) {
  body { padding: 12px; }
  .toolbar, .workspace, .layout, .subgrid { grid-template-columns: 1fr; }
}
</style>
