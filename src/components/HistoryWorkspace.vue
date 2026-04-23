<script setup lang="ts">
import type { CloudMeta, PublishEntry, TimelineRow } from '../types/panel';

defineProps<{
  filteredHistory: PublishEntry[];
  selectedHistoryKey: string | null;
  selectedEntry: PublishEntry | null;
  callbackRows: TimelineRow[];
  relatedRows: TimelineRow[];
  shortTime: (ts: number) => string;
  timeText: (ts: number) => string;
  cloudMeta: (row: TimelineRow | null | undefined) => CloudMeta | null;
}>();

const emit = defineEmits<{
  'update:selectedHistoryKey': [value: string];
}>();
</script>

<template>
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
          @click="emit('update:selectedHistoryKey', entry.key)"
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
</template>
