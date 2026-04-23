<script setup lang="ts">
defineProps<{
  currentConnection: { name: string; state: string } | null;
  debugState: string;
  airportOnline: { state: string; text: string; time: number };
  droneOnline: { state: string; text: string; time: number };
  filteredHistoryCount: number;
  callbackCount: number;
  feedback: string;
  feedbackTone: 'info' | 'error';
  airport: string;
  drone: string;
  airportOptions: string[];
  droneOptions: string[];
  canOperate: boolean;
  debugToggleLabel: string;
  actionBusy: boolean;
  statusText: string;
  statusMetaBits: string[];
  shortTime: (ts: number) => string;
}>();

const emit = defineEmits<{
  'update:airport': [value: string];
  'update:drone': [value: string];
  toggleDebug: [];
  restartBootstrap: [];
}>();
</script>

<template>
  <div class="topbar">
    <div class="badge">
      {{ currentConnection ? `${currentConnection.name} / ${currentConnection.state}` : '连接未选择' }}
    </div>
    <div class="status-pill" :class="debugState === 'enabled' ? 'enabled' : debugState === 'disabled' ? 'disabled' : ''">
      {{ `Debug ${debugState === 'enabled' ? '已开启' : debugState === 'disabled' ? '已关闭' : '未识别'}` }}
    </div>
    <div class="badge" :class="airportOnline.state">
      {{ `机场 ${airportOnline.text}${airportOnline.time ? ` / ${shortTime(airportOnline.time)}` : ''}` }}
    </div>
    <div class="badge" :class="droneOnline.state">
      {{ `无人机 ${droneOnline.text}${droneOnline.time ? ` / ${shortTime(droneOnline.time)}` : ''}` }}
    </div>
    <div class="badge">
      {{ `${filteredHistoryCount} 条发送 / ${callbackCount} 条回调` }}
    </div>
  </div>

  <div v-if="feedback" class="notice" :class="feedbackTone">
    {{ feedback }}
  </div>

  <div class="toolbar">
    <label class="field">
      <span>机场</span>
      <select :value="airport" @change="emit('update:airport', ($event.target as HTMLSelectElement).value)">
        <option value="all">全部机场</option>
        <option v-for="item in airportOptions" :key="item" :value="item">{{ item }}</option>
      </select>
    </label>

    <label class="field">
      <span>无人机</span>
      <select :value="drone" @change="emit('update:drone', ($event.target as HTMLSelectElement).value)">
        <option value="all">全部无人机</option>
        <option v-for="item in droneOptions" :key="item" :value="item">{{ item }}</option>
      </select>
    </label>

    <button class="action-button" :disabled="!canOperate" @click="emit('toggleDebug')">
      {{ debugToggleLabel }}
    </button>

    <button class="action-button secondary" :disabled="!canOperate" @click="emit('restartBootstrap')">
      {{ actionBusy ? '执行中...' : '重启注册上线' }}
    </button>
  </div>

  <div class="status-card">
    <div class="status-main">
      <div class="status-title">当前 Debug 状态</div>
      <div class="status-value">{{ statusText }}</div>
      <div class="status-meta">
        <span v-for="item in statusMetaBits" :key="item">{{ item }}</span>
      </div>
    </div>

    <div class="status-main">
      <div class="status-title">说明</div>
      <div class="mini">插件页面已经拆成组件和 composable，后面继续扩展会更稳。</div>
    </div>
  </div>
</template>
