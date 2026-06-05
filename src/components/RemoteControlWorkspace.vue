<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { StickChannels, StickVector } from '../types/panel';

type StickPad = 'left' | 'right';

type StickUpdate = Partial<StickVector>;

const props = defineProps<{
  canOperate: boolean;
  canRemoteOperate: boolean;
  remoteControlArmed: boolean;
  stickRateHz: number;
  stickState: StickVector;
  stickChannels: StickChannels;
  cameraPayloadIndex: string;
  cameraPayloadIndexOptions: string[];
  cameraLocked: boolean;
  cameraMaxPitchSpeed: number;
  cameraMaxYawSpeed: number;
  remoteLastPayload: string;
  remoteFeedback: string;
  airport: string;
  drone: string;
  airportOnlineText: string;
  droneOnlineText: string;
  debugState: string;
}>();

const emit = defineEmits<{
  'update:remoteControlArmed': [value: boolean];
  'update:stickRateHz': [value: number];
  'update:cameraPayloadIndex': [value: string];
  'update:cameraLocked': [value: boolean];
  'update:cameraMaxPitchSpeed': [value: number];
  'update:cameraMaxYawSpeed': [value: number];
  'publish-stick': [value: StickVector];
  'send-neutral': [];
  'camera-drag': [value: { dx: number; dy: number }];
  'stop-camera-drag': [];
  'remote-stop': [];
}>();

const leftPad = ref<HTMLElement | null>(null);
const rightPad = ref<HTMLElement | null>(null);
const cameraPad = ref<HTMLElement | null>(null);
const activeStickPad = ref<StickPad | null>(null);
const activeCamera = ref(false);
const leftKnob = ref({ x: 0, y: 0 });
const rightKnob = ref({ x: 0, y: 0 });
const cameraKnob = ref({ x: 0, y: 0 });

let stickTimer: number | null = null;
let cameraTimer: number | null = null;
let pendingStick: StickVector = { ...props.stickState };
let pendingCamera = { dx: 0, dy: 0 };

const armText = computed(() => props.remoteControlArmed ? '已解锁遥控控制' : '解锁遥控控制');
const statusText = computed(() => {
  if (!props.canOperate) return '请选择已连接的连接和具体机场';
  if (!props.remoteControlArmed) return '未解锁，拖动不会发布 MQTT';
  return `发布已启用，摇杆 ${props.stickRateHz}Hz`;
});
const previewPayload = computed(() => props.remoteLastPayload || '暂无发布 payload');

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function eventVector(event: PointerEvent, element: HTMLElement): { x: number; y: number } {
  const rect = element.getBoundingClientRect();
  const radius = Math.max(1, Math.min(rect.width, rect.height) / 2);
  const x = clamp((event.clientX - rect.left - rect.width / 2) / radius, -1, 1);
  const y = clamp((event.clientY - rect.top - rect.height / 2) / radius, -1, 1);
  return { x, y };
}

function mergedStick(update: StickUpdate): StickVector {
  return { ...pendingStick, ...update };
}

function scheduleStickPublish(): void {
  if (!props.canRemoteOperate) return;
  if (stickTimer != null) return;
  const interval = Math.round(1000 / clamp(props.stickRateHz || 5, 1, 10));
  stickTimer = window.setInterval(() => {
    if (!props.canRemoteOperate || !activeStickPad.value) return;
    emit('publish-stick', { ...pendingStick });
  }, interval);
}

function stopStickTimer(): void {
  if (stickTimer != null) window.clearInterval(stickTimer);
  stickTimer = null;
}

function updateStickFromPad(pad: StickPad, event: PointerEvent): void {
  const element = pad === 'left' ? leftPad.value : rightPad.value;
  if (!element) return;
  const vector = eventVector(event, element);
  if (pad === 'left') {
    leftKnob.value = vector;
    pendingStick = mergedStick({ yaw: vector.x, throttle: -vector.y });
  } else {
    rightKnob.value = vector;
    pendingStick = mergedStick({ roll: vector.x, pitch: -vector.y });
  }
}

function startStick(pad: StickPad, event: PointerEvent): void {
  if (!props.canRemoteOperate) return;
  activeStickPad.value = pad;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  updateStickFromPad(pad, event);
  emit('publish-stick', { ...pendingStick });
  scheduleStickPublish();
}

function moveStick(pad: StickPad, event: PointerEvent): void {
  if (activeStickPad.value !== pad) return;
  updateStickFromPad(pad, event);
}

function stopStick(pad: StickPad, event?: PointerEvent): void {
  if (activeStickPad.value !== pad) return;
  if (event?.currentTarget) {
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* noop */ }
  }
  activeStickPad.value = null;
  stopStickTimer();
  leftKnob.value = { x: 0, y: 0 };
  rightKnob.value = { x: 0, y: 0 };
  pendingStick = { roll: 0, pitch: 0, throttle: 0, yaw: 0, gimbalPitch: pendingStick.gimbalPitch };
  emit('send-neutral');
}

function updateGimbalPitch(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  pendingStick = mergedStick({ gimbalPitch: clamp(value, -1, 1) });
  if (props.canRemoteOperate) emit('publish-stick', { ...pendingStick });
}

function scheduleCameraPublish(): void {
  if (!props.canRemoteOperate) return;
  if (cameraTimer != null) return;
  cameraTimer = window.setInterval(() => {
    if (!props.canRemoteOperate || !activeCamera.value) return;
    emit('camera-drag', { ...pendingCamera });
  }, 220);
}

function stopCameraTimer(): void {
  if (cameraTimer != null) window.clearInterval(cameraTimer);
  cameraTimer = null;
}

function updateCamera(event: PointerEvent): void {
  if (!cameraPad.value) return;
  const vector = eventVector(event, cameraPad.value);
  cameraKnob.value = vector;
  pendingCamera = { dx: vector.x, dy: vector.y };
}

function startCamera(event: PointerEvent): void {
  if (!props.canRemoteOperate) return;
  activeCamera.value = true;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  updateCamera(event);
  emit('camera-drag', { ...pendingCamera });
  scheduleCameraPublish();
}

function moveCamera(event: PointerEvent): void {
  if (!activeCamera.value) return;
  updateCamera(event);
}

function stopCamera(event?: PointerEvent): void {
  if (!activeCamera.value) return;
  if (event?.currentTarget) {
    try { (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId); } catch { /* noop */ }
  }
  activeCamera.value = false;
  stopCameraTimer();
  cameraKnob.value = { x: 0, y: 0 };
  pendingCamera = { dx: 0, dy: 0 };
  emit('stop-camera-drag');
}

function stopEverything(): void {
  activeStickPad.value = null;
  activeCamera.value = false;
  stopStickTimer();
  stopCameraTimer();
  leftKnob.value = { x: 0, y: 0 };
  rightKnob.value = { x: 0, y: 0 };
  cameraKnob.value = { x: 0, y: 0 };
  pendingStick = { roll: 0, pitch: 0, throttle: 0, yaw: 0, gimbalPitch: 0 };
  pendingCamera = { dx: 0, dy: 0 };
  emit('remote-stop');
}

onBeforeUnmount(() => {
  stopStickTimer();
  stopCameraTimer();
});
</script>

<template>
  <section class="panel remote-panel">
    <div class="panel-head">遥控控制 · stick_control / camera_screen_drag</div>
    <div class="panel-body remote-body">
      <div class="remote-topline">
        <div class="stat-line">
          <span>{{ `机场 ${airport}` }}</span>
          <span>{{ `无人机 ${drone}` }}</span>
          <span>{{ airportOnlineText }}</span>
          <span>{{ droneOnlineText }}</span>
          <span>{{ `Debug ${debugState}` }}</span>
        </div>
        <div class="field-actions">
          <button class="action-button" :class="{ secondary: remoteControlArmed }" :disabled="!canOperate" @click="emit('update:remoteControlArmed', !remoteControlArmed)">
            {{ armText }}
          </button>
          <button class="tiny ghost" :disabled="!canOperate" @click="stopEverything">归中/停止</button>
        </div>
      </div>

      <div class="notice" :class="remoteControlArmed ? 'info' : 'error'">
        {{ statusText }}。stick_control 字段来自真实 MQTT 样本；松手会发送 1024 归中。请确认现场安全后再解锁。
      </div>

      <div class="remote-grid">
        <div class="stick-card">
          <div class="stick-title">左摇杆 · 油门 / 偏航</div>
          <div
            ref="leftPad"
            class="stick-pad"
            :class="{ active: activeStickPad === 'left', disabled: !canRemoteOperate }"
            @pointerdown="startStick('left', $event)"
            @pointermove="moveStick('left', $event)"
            @pointerup="stopStick('left', $event)"
            @pointercancel="stopStick('left', $event)"
            @pointerleave="stopStick('left', $event)"
          >
            <div class="stick-cross"></div>
            <div class="stick-knob" :style="{ transform: `translate(${leftKnob.x * 58}px, ${leftKnob.y * 58}px)` }"></div>
          </div>
          <div class="stat-line">
            <span>{{ `throttle ${stickChannels.throttle}` }}</span>
            <span>{{ `yaw ${stickChannels.yaw}` }}</span>
          </div>
        </div>

        <div class="stick-card">
          <div class="stick-title">右摇杆 · 横滚 / 俯仰</div>
          <div
            ref="rightPad"
            class="stick-pad"
            :class="{ active: activeStickPad === 'right', disabled: !canRemoteOperate }"
            @pointerdown="startStick('right', $event)"
            @pointermove="moveStick('right', $event)"
            @pointerup="stopStick('right', $event)"
            @pointercancel="stopStick('right', $event)"
            @pointerleave="stopStick('right', $event)"
          >
            <div class="stick-cross"></div>
            <div class="stick-knob" :style="{ transform: `translate(${rightKnob.x * 58}px, ${rightKnob.y * 58}px)` }"></div>
          </div>
          <div class="stat-line">
            <span>{{ `roll ${stickChannels.roll}` }}</span>
            <span>{{ `pitch ${stickChannels.pitch}` }}</span>
          </div>
        </div>

        <div class="stick-card camera-card">
          <div class="stick-title">画面拖动 · 云台 pitch/yaw</div>
          <div
            ref="cameraPad"
            class="camera-pad"
            :class="{ active: activeCamera, disabled: !canRemoteOperate }"
            @pointerdown="startCamera"
            @pointermove="moveCamera"
            @pointerup="stopCamera"
            @pointercancel="stopCamera"
            @pointerleave="stopCamera"
          >
            <div class="stick-cross"></div>
            <div class="camera-knob" :style="{ transform: `translate(${cameraKnob.x * 90}px, ${cameraKnob.y * 54}px)` }"></div>
            <span>拖动画面发送 camera_screen_drag</span>
          </div>
        </div>
      </div>

      <div class="remote-config subgrid">
        <label class="field">
          <span>发布频率</span>
          <select :value="stickRateHz" @change="emit('update:stickRateHz', Number(($event.target as HTMLSelectElement).value))">
            <option :value="5">5 Hz</option>
            <option :value="8">8 Hz</option>
            <option :value="10">10 Hz</option>
          </select>
        </label>
        <label class="field">
          <span>gimbal_pitch（-1..1）</span>
          <input :value="stickState.gimbalPitch" type="range" min="-1" max="1" step="0.01" @input="updateGimbalPitch">
        </label>
        <label class="field">
          <span>payload_index</span>
          <input :value="cameraPayloadIndex" list="camera-payload-indexes" placeholder="例如 99-0-0" @input="emit('update:cameraPayloadIndex', ($event.target as HTMLInputElement).value)">
          <datalist id="camera-payload-indexes">
            <option v-for="item in cameraPayloadIndexOptions" :key="item" :value="item"></option>
          </datalist>
        </label>
        <label class="field">
          <span>机头/云台锁定</span>
          <select :value="String(cameraLocked)" @change="emit('update:cameraLocked', ($event.target as HTMLSelectElement).value === 'true')">
            <option value="true">true · 机头与云台锁定</option>
            <option value="false">false · 仅云台转</option>
          </select>
        </label>
        <label class="field">
          <span>Pitch 最大速度</span>
          <input :value="cameraMaxPitchSpeed" type="number" min="0" step="0.1" @input="emit('update:cameraMaxPitchSpeed', Number(($event.target as HTMLInputElement).value))">
        </label>
        <label class="field">
          <span>Yaw 最大速度</span>
          <input :value="cameraMaxYawSpeed" type="number" min="0" step="0.1" @input="emit('update:cameraMaxYawSpeed', Number(($event.target as HTMLInputElement).value))">
        </label>
      </div>

      <div class="remote-preview">
        <div class="row">
          <span class="method">最近遥控反馈</span>
          <span class="mini">{{ remoteFeedback || '暂无' }}</span>
        </div>
        <pre>{{ previewPayload }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.remote-body { gap: 12px; }
.remote-topline { display: flex; justify-content: space-between; gap: 12px; align-items: center; flex-wrap: wrap; }
.remote-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.stick-card {
  border: 1px solid var(--line); border-radius: 16px; background: var(--panel-soft);
  padding: 12px; display: flex; flex-direction: column; gap: 10px; min-width: 0;
}
.stick-title { font-size: 12px; color: var(--muted); font-weight: 700; letter-spacing: 0.04em; }
.stick-pad, .camera-pad {
  position: relative; height: 168px; border-radius: 18px; overflow: hidden; touch-action: none; user-select: none;
  border: 1px solid rgba(56, 189, 248, 0.22);
  background:
    radial-gradient(circle at center, rgba(56, 189, 248, 0.18), transparent 34%),
    rgba(2, 6, 23, 0.46);
  display: grid; place-items: center;
}
.camera-pad { height: 168px; }
.stick-pad.disabled, .camera-pad.disabled { opacity: 0.55; }
.stick-pad.active, .camera-pad.active { border-color: rgba(52, 211, 153, 0.55); box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.24) inset; }
.stick-cross::before, .stick-cross::after {
  content: ''; position: absolute; inset: 50% auto auto 0; width: 100%; height: 1px; background: rgba(148, 163, 184, 0.18);
}
.stick-cross::after { inset: 0 auto auto 50%; width: 1px; height: 100%; }
.stick-knob, .camera-knob {
  width: 48px; height: 48px; border-radius: 999px;
  background: linear-gradient(135deg, #38bdf8, #34d399);
  box-shadow: 0 12px 30px rgba(8, 47, 73, 0.55);
  pointer-events: none;
}
.camera-knob { width: 34px; height: 34px; }
.camera-pad span { position: absolute; bottom: 12px; color: var(--muted); font-size: 12px; }
.remote-config { align-items: end; }
.remote-preview { border: 1px solid var(--line); border-radius: 14px; background: var(--panel-soft); padding: 12px; }
.remote-preview pre { max-height: 120px; }
@media (max-width: 900px) {
  .remote-grid { grid-template-columns: 1fr; }
}
</style>
