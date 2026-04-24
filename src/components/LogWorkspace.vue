<script setup lang="ts">
import type { LogEntry, OssProfile, UploadProgressRow } from '../types/panel';

defineProps<{
  canOperate: boolean;
  logStartTime: string;
  logEndTime: string;
  moduleDrone: boolean;
  moduleDock: boolean;
  filteredLogRows: LogEntry[];
  logEntries: LogEntry[];
  selectedLogKeys: Record<string, boolean>;
  selectedLogCount: number;
  rawLogBytes: number;
  filteredLogBytes: number;
  uploadProgressRows: UploadProgressRow[];
  uploadRequest: { time: number; modules: string[] } | null;
  ossProfiles: OssProfile[];
  activeOssProfileId: string;
  ossForm: OssProfile;
  bytesText: (size: number) => string;
  timeText: (ts: number) => string;
  moduleLabel: (moduleCode: string) => string;
  logEntryKey: (entry: LogEntry) => string;
}>();

const emit = defineEmits<{
  'update:logStartTime': [value: string];
  'update:logEndTime': [value: string];
  'update:moduleDrone': [value: boolean];
  'update:moduleDock': [value: boolean];
  'update:activeOssProfileId': [value: string];
  'update:ossField': [field: keyof OssProfile, value: string];
  queryLogs: [];
  selectAllLogs: [];
  clearLogSelection: [];
  setLogSelected: [entry: LogEntry, checked: boolean];
  uploadSelected: [];
  cancelUpload: [];
  saveCurrentProfile: [];
  createNewProfile: [];
  deleteCurrentProfile: [];
}>();
</script>

<template>
  <div class="workspace">
    <section class="panel">
      <div class="panel-head">日志查询与选择</div>
      <div class="panel-body">
        <div class="subgrid">
          <label class="field">
            <span>开始时间</span>
            <input :value="logStartTime" type="datetime-local" @input="emit('update:logStartTime', ($event.target as HTMLInputElement).value)">
          </label>
          <label class="field">
            <span>结束时间</span>
            <input :value="logEndTime" type="datetime-local" @input="emit('update:logEndTime', ($event.target as HTMLInputElement).value)">
          </label>
        </div>

        <div class="field">
          <span>日志模块</span>
          <div class="field-actions">
            <label class="checkline">
              <input :checked="moduleDrone" type="checkbox" @change="emit('update:moduleDrone', ($event.target as HTMLInputElement).checked)">
              飞行器
            </label>
            <label class="checkline">
              <input :checked="moduleDock" type="checkbox" @change="emit('update:moduleDock', ($event.target as HTMLInputElement).checked)">
              机场
            </label>
          </div>
        </div>

        <div class="field-actions">
          <button class="action-button" :disabled="!canOperate" @click="emit('queryLogs')">查询可上传日志</button>
          <button class="tiny" @click="emit('selectAllLogs')">全选筛选结果</button>
          <button class="tiny ghost" @click="emit('clearLogSelection')">清空已选</button>
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
            <input type="checkbox" :checked="!!selectedLogKeys[logEntryKey(item)]" @change="emit('setLogSelected', item, ($event.target as HTMLInputElement).checked)">
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
            <select :value="activeOssProfileId" @change="emit('update:activeOssProfileId', ($event.target as HTMLSelectElement).value)">
              <option v-for="item in ossProfiles" :key="item.id" :value="item.id">{{ item.name || '未命名配置' }}</option>
            </select>
          </label>
          <label class="field">
            <span>档案名称</span>
            <input :value="ossForm.name" type="text" placeholder="例如 阿里云生产环境" @input="emit('update:ossField', 'name', ($event.target as HTMLInputElement).value)">
          </label>
        </div>

        <div class="field-actions">
          <button class="tiny" @click="emit('saveCurrentProfile')">保存当前配置</button>
          <button class="tiny" @click="emit('createNewProfile')">新建配置</button>
          <button class="tiny ghost" @click="emit('deleteCurrentProfile')">删除配置</button>
        </div>

        <div class="subgrid">
          <label class="field">
            <span>Provider</span>
            <select :value="ossForm.provider" @change="emit('update:ossField', 'provider', ($event.target as HTMLSelectElement).value)">
              <option value="ali">ali</option>
              <option value="aws">aws</option>
              <option value="minio">minio</option>
            </select>
          </label>
          <label class="field"><span>Region</span><input :value="ossForm.region" type="text" @input="emit('update:ossField', 'region', ($event.target as HTMLInputElement).value)"></label>
          <label class="field"><span>Bucket</span><input :value="ossForm.bucket" type="text" @input="emit('update:ossField', 'bucket', ($event.target as HTMLInputElement).value)"></label>
          <label class="field"><span>Endpoint</span><input :value="ossForm.endpoint" type="text" @input="emit('update:ossField', 'endpoint', ($event.target as HTMLInputElement).value)"></label>
          <label class="field"><span>上传前缀</span><input :value="ossForm.keyPrefix" type="text" @input="emit('update:ossField', 'keyPrefix', ($event.target as HTMLInputElement).value)"></label>
          <label class="field"><span>Access Key ID</span><input :value="ossForm.access_key_id" class="secret" type="text" @input="emit('update:ossField', 'access_key_id', ($event.target as HTMLInputElement).value)"></label>
          <label class="field"><span>Access Key Secret</span><input :value="ossForm.access_key_secret" class="secret" type="password" @input="emit('update:ossField', 'access_key_secret', ($event.target as HTMLInputElement).value)"></label>
        </div>

        <label class="field">
          <span>Security Token（可选）</span>
          <input :value="ossForm.security_token" class="secret" type="text" @input="emit('update:ossField', 'security_token', ($event.target as HTMLInputElement).value)">
        </label>

        <div class="field-actions">
          <button class="action-button secondary" :disabled="!canOperate" @click="emit('uploadSelected')">上传已选日志</button>
          <button class="tiny ghost" :disabled="!canOperate" @click="emit('cancelUpload')">取消上传</button>
        </div>

        <div class="stat-line">
          <span>{{ `配置 ${ossProfiles.find((item) => item.id === activeOssProfileId)?.name || '未命名配置'}` }}</span>
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
            <div class="progress-bar"><div class="progress-fill" :style="{ width: `${Math.max(0, Math.min(100, item.progress))}%` }"></div></div>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>
