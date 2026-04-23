<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { mountPanel } from './panelRuntime';

let teardown: (() => void) | null = null;

onMounted(() => {
  teardown = mountPanel();
});

onBeforeUnmount(() => {
  teardown?.();
  teardown = null;
});
</script>

<template>

  <div class="page">
    <div class="topbar">
      <div id="connectionBadge" class="badge">连接未选择</div>
      <div id="debugPill" class="status-pill">Debug 未识别</div>
      <div id="airportOnlineBadge" class="badge unknown">机场状态未识别</div>
      <div id="droneOnlineBadge" class="badge unknown">无人机状态未识别</div>
      <div id="statsBadge" class="badge">0 条发送 / 0 条回调</div>
    </div>

    <div class="toolbar">
      <label class="field">
        <span>机场</span>
        <select id="airportSelect"></select>
      </label>
      <label class="field">
        <span>无人机</span>
        <select id="droneSelect"></select>
      </label>
      <button id="debugToggle" class="action-button">开启 Debug</button>
      <button id="restartBootstrap" class="action-button secondary">重启注册上线</button>
    </div>

    <div class="status-card">
      <div class="status-main">
        <div class="status-title">当前 Debug 状态</div>
        <div id="statusValue" class="status-value">暂未识别</div>
        <div id="statusMeta" class="status-meta"></div>
      </div>
      <div class="status-main">
        <div class="status-title">说明</div>
        <div class="mini">插件页面已完全运行在插件仓库中。宿主只负责提供消息快照与发送能力。</div>
      </div>
    </div>

    <div class="workspace">
      <section class="panel">
        <div class="panel-head">日志查询与选择</div>
        <div class="panel-body">
          <div class="subgrid">
            <label class="field">
              <span>开始时间</span>
              <input id="logStartTime" type="datetime-local">
            </label>
            <label class="field">
              <span>结束时间</span>
              <input id="logEndTime" type="datetime-local">
            </label>
          </div>
          <div class="field">
            <span>日志模块</span>
            <div class="field-actions">
              <label class="checkline"><input id="moduleDrone" type="checkbox" checked>飞行器</label>
              <label class="checkline"><input id="moduleDock" type="checkbox" checked>机场</label>
            </div>
          </div>
          <div class="field-actions">
            <button id="queryLogsBtn" class="action-button">查询可上传日志</button>
            <button id="selectAllLogsBtn" class="tiny">全选筛选结果</button>
            <button id="clearLogSelectionBtn" class="tiny ghost">清空已选</button>
          </div>
          <div id="logStats" class="stat-line"></div>
          <div id="logList" class="log-list"></div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-head">OSS 配置与上传进度</div>
        <div class="panel-body">
          <div class="subgrid">
            <label class="field">
              <span>配置档案</span>
              <select id="ossProfileSelect"></select>
            </label>
            <label class="field">
              <span>档案名称</span>
              <input id="ossProfileName" type="text" placeholder="例如 默认阿里云">
            </label>
          </div>
          <div class="field-actions">
            <button id="saveOssBtn" class="tiny">保存当前配置</button>
            <button id="newOssBtn" class="tiny">新建配置</button>
            <button id="deleteOssBtn" class="tiny ghost">删除配置</button>
          </div>
          <div class="subgrid">
            <label class="field">
              <span>Provider</span>
              <select id="ossProvider">
                <option value="ali">ali</option>
                <option value="aws">aws</option>
                <option value="minio">minio</option>
              </select>
            </label>
            <label class="field">
              <span>Region</span>
              <input id="ossRegion" type="text" placeholder="例如 hz">
            </label>
            <label class="field">
              <span>Bucket</span>
              <input id="ossBucket" type="text" placeholder="对象存储桶名称">
            </label>
            <label class="field">
              <span>Endpoint</span>
              <input id="ossEndpoint" type="text" placeholder="https://oss-cn-hangzhou.aliyuncs.com">
            </label>
            <label class="field">
              <span>上传前缀</span>
              <input id="ossKeyPrefix" type="text" placeholder="例如 dock-logs/prod">
            </label>
            <label class="field">
              <span>Expire</span>
              <input id="ossExpire" type="number" placeholder="毫秒时间戳">
            </label>
            <label class="field">
              <span>Access Key ID</span>
              <input id="ossAccessKeyId" class="secret" type="text">
            </label>
            <label class="field">
              <span>Access Key Secret</span>
              <input id="ossAccessKeySecret" class="secret" type="password">
            </label>
          </div>
          <label class="field">
            <span>Security Token</span>
            <input id="ossSecurityToken" class="secret" type="text">
          </label>
          <div class="field-actions">
            <button id="uploadSelectedBtn" class="action-button secondary">上传已选日志</button>
            <button id="cancelUploadBtn" class="tiny ghost">取消上传</button>
          </div>
          <div id="uploadSummary" class="stat-line"></div>
          <div id="progressList" class="progress-list"></div>
        </div>
      </section>
    </div>

    <div class="layout">
      <section class="panel">
        <div class="panel-head">发送历史</div>
        <div id="historyList" class="panel-body"></div>
      </section>
      <section class="panel">
        <div class="panel-head">详情</div>
        <div id="detailPane" class="panel-body"></div>
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
      --accent-soft: rgba(56, 189, 248, 0.16);
      --warn: #fbbf24;
      font-family: "Microsoft YaHei UI", "PingFang SC", sans-serif;
    }

    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background:
      radial-gradient(circle at top right, rgba(56,189,248,0.12), transparent 28%),
      radial-gradient(circle at top left, rgba(52,211,153,0.08), transparent 25%),
      linear-gradient(180deg, #0b1220, #111827 60%, #0f172a);
      color: var(--text);
    }
    body { padding: 16px; }
    button, input, select { font: inherit; }
    button { cursor: pointer; }
    .page { display: flex; flex-direction: column; gap: 14px; min-height: calc(100vh - 32px); }
    .topbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .badge, .status-pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 12px; border-radius: 999px;
      background: rgba(15,23,42,0.78); border: 1px solid var(--line); color: var(--muted);
    }
    .badge.online { color: var(--good); border-color: rgba(52,211,153,0.28); background: rgba(52,211,153,0.12); }
    .badge.offline { color: var(--bad); border-color: rgba(248,113,113,0.26); background: rgba(248,113,113,0.1); }
    .badge.unknown { color: var(--warn); border-color: rgba(251,191,36,0.26); background: rgba(251,191,36,0.1); }
    .status-pill.enabled { color: var(--good); border-color: rgba(52,211,153,0.28); background: rgba(52,211,153,0.12); }
    .status-pill.disabled { color: var(--bad); border-color: rgba(248,113,113,0.26); background: rgba(248,113,113,0.1); }
    .toolbar {
      display: grid; grid-template-columns: minmax(180px, 240px) minmax(180px, 240px) minmax(180px, 220px) minmax(180px, 220px);
      gap: 12px; align-items: end;
    }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 12px; color: var(--muted); }
    select, input, .action-button {
      min-height: 40px; border-radius: 12px; border: 1px solid var(--line);
      background: rgba(15,23,42,0.72); color: var(--text); padding: 0 12px;
    }
    .action-button {
      background: linear-gradient(135deg, rgba(56,189,248,0.24), rgba(14,165,233,0.16));
      color: #e0f2fe; font-weight: 700;
    }
    .action-button.secondary {
      background: linear-gradient(135deg, rgba(52,211,153,0.2), rgba(16,185,129,0.12));
      color: #d1fae5;
    }
    .action-button[disabled] { cursor: not-allowed; opacity: 0.5; }
    .status-card {
      background: linear-gradient(135deg, rgba(30,41,59,0.92), rgba(15,23,42,0.9));
      border: 1px solid var(--line); border-radius: 18px; padding: 16px 18px;
      display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    }
    .status-main { display: flex; flex-direction: column; gap: 8px; }
    .status-title { color: var(--muted); font-size: 12px; letter-spacing: 0.04em; }
    .status-value { font-size: 28px; font-weight: 800; }
    .status-meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; font-family: Consolas, monospace; }
    .layout {
      flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 14px;
    }
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
      border: 1px solid var(--line); border-radius: 14px; padding: 12px;
      background: var(--panel-soft); user-select: text;
    }
    .history-item {
      cursor: pointer; width: 100%; text-align: left; appearance: none;
      display: block;
    }
    .history-item.active { border-color: rgba(56,189,248,0.42); box-shadow: 0 0 0 1px rgba(56,189,248,0.2) inset; }
    .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .row + .row { margin-top: 8px; }
    .method { font-weight: 700; color: #f8fafc; }
    .time { margin-left: auto; color: var(--muted); font-size: 12px; font-family: Consolas, monospace; }
    .mini { color: var(--muted); font-size: 12px; }
    .pill {
      display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
      border: 1px solid var(--line); font-size: 11px; color: var(--muted);
    }
    .pill.reply { color: var(--good); border-color: rgba(52,211,153,0.26); background: rgba(52,211,153,0.12); }
    pre {
      margin: 8px 0 0; padding: 12px; border-radius: 12px; background: rgba(2,6,23,0.56);
      white-space: pre-wrap; word-break: break-all; overflow: auto; line-height: 1.55;
      font-family: Consolas, "JetBrains Mono", monospace; font-size: 12px; color: #cbd5e1;
    }
    .empty { color: var(--muted); padding: 24px; text-align: center; }
    .stack { display: flex; flex-direction: column; gap: 12px; }
    .workspace {
      display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 14px;
    }
    .subgrid {
      display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
    }
    .subgrid.single { grid-template-columns: 1fr; }
    .field-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .checkline {
      display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; min-height: 40px;
      border-radius: 12px; border: 1px solid var(--line); background: rgba(15,23,42,0.72); color: var(--text);
    }
    .checkline input { accent-color: var(--accent); }
    .tiny {
      min-height: 34px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line);
      background: rgba(15,23,42,0.72); color: var(--text);
    }
    .tiny.ghost { background: transparent; }
    .stat-line { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; }
    .log-list, .progress-list { display: flex; flex-direction: column; gap: 10px; }
    .log-item {
      border: 1px solid var(--line); border-radius: 14px; background: var(--panel-soft);
      padding: 12px; display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: start;
    }
    .log-item.active { border-color: rgba(56,189,248,0.42); }
    .log-item input { margin-top: 4px; accent-color: var(--accent); }
    .log-title { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .log-meta { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font-size: 12px; margin-top: 6px; }
    .progress-item {
      border: 1px solid var(--line); border-radius: 14px; background: var(--panel-soft);
      padding: 12px;
    }
    .progress-bar {
      width: 100%; height: 10px; border-radius: 999px; overflow: hidden;
      background: rgba(15,23,42,0.7); border: 1px solid var(--line); margin-top: 10px;
    }
    .progress-fill {
      height: 100%; background: linear-gradient(90deg, #38bdf8, #34d399);
    }
    .secret { font-family: Consolas, "JetBrains Mono", monospace; }
    @media (max-width: 980px) {
      body { padding: 12px; }
      .toolbar { grid-template-columns: 1fr; }
      .layout { grid-template-columns: 1fr; }
      .workspace { grid-template-columns: 1fr; }
      .subgrid { grid-template-columns: 1fr; }
    }
  

</style>
