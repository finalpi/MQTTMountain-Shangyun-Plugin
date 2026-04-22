/**
 * MQTTMountain 插件：大疆上云 API（Dock 3）
 *
 * 协议参考：
 *   https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/properties.html
 *
 * 覆盖范围：
 *   - 主题识别：thing/product/{sn}/{state|events|osd|services|requests|...}
 *   - 消息解析：method / data / bid / tid / gateway / timestamp
 *   - Dock 3 state 属性中文字段翻译
 *   - 常用 services 指令模板（插件 senders）
 */

'use strict';

// ---------- topic 工具 ----------
const TOPIC_RE = /^(thing|sys)\/product\/([^/]+)\/(.+)$/;

const TOPIC_SUFFIX_LABEL = {
    state: '状态上报',
    state_reply: '状态应答',
    osd: 'OSD 实时推送',
    osd_reply: 'OSD 应答',
    events: '事件上报',
    events_reply: '事件应答',
    services: '下行指令',
    services_reply: '指令应答',
    requests: '上行请求',
    requests_reply: '请求应答',
    properties: '属性设置',
    properties_reply: '属性设置应答',
    status: '设备上线',
    status_reply: '设备上线应答'
};

const DIR_ICON = {
    state: '📊',
    state_reply: '📊',
    osd: '📡',
    osd_reply: '📡',
    events: '🚨',
    events_reply: '🚨',
    services: '💬',
    services_reply: '✅',
    requests: '📨',
    requests_reply: '📨',
    properties: '⚙️',
    properties_reply: '⚙️',
    status: '🔌',
    status_reply: '🔌'
};

// ---------- Dock 3 属性字段中文名（节选高频字段） ----------
// 完整字段参考 https://developer.dji.com/doc/cloud-api-tutorial/cn/api-reference/dock-to-cloud/mqtt/dock/dock3/properties.html
const DOCK3_FIELD_LABEL = {
    job_number: '作业次数',
    acc_time: '累计通电时长（秒）',
    activation_time: '激活时间',
    maintain_status: '维护状态',
    maintain_status_array: '维护状态数组',
    electric_supply_voltage: '交流供电电压（V）',
    working_voltage: '工作电压（mV）',
    working_current: '工作电流（mA）',
    acdc_power_input: 'AC/DC 功率输入（W）',
    poe_link_status: 'POE 连接状态',
    poe_power_output: 'POE 功率输出',
    backup_battery: '备份电池',
    gimbal_holder_state: '云台收纳状态',
    drone_battery_maintenance_info: '飞机电池维保信息',
    temp_mode_state: '温控模式',
    self_converge_coordinate: '机场自收敛坐标',
    relative_alternate_land_point: '备降点',
    deployment_mode: '部署模式',
    drone_in_dock: '飞机在舱',
    drone_charge_state: '飞机充电状态',
    cover_state: '机舱盖状态',
    supplement_light_state: '补光灯',
    emergency_stop_state: '急停开关',
    air_conditioner_mode: '空调模式',
    alarm_state: '蜂鸣报警',
    putter_state: '推杆状态',
    environment_temperature: '环境温度（℃）',
    environment_humidity: '环境湿度（%）',
    temperature: '温度',
    wind_speed: '风速',
    rainfall: '雨量',
    first_power_on: '首次上电时间',
    network_state: '网络状态',
    sdr: 'SDR 链路',
    live_status: '直播状态',
    flighttask_step_code: '任务步骤',
    flighttask_progress: '任务进度'
};

// ---------- helpers ----------
function safeParseJson(s) {
    try { return JSON.parse(s); } catch { return null; }
}

function truncateVal(v, max = 48) {
    if (v == null) return '';
    if (typeof v === 'object') {
        const s = JSON.stringify(v);
        return s.length > max ? s.slice(0, max) + '…' : s;
    }
    const s = String(v);
    return s.length > max ? s.slice(0, max) + '…' : s;
}

function formatTs(ts) {
    if (!ts || typeof ts !== 'number') return '';
    try { return new Date(ts).toISOString(); } catch { return String(ts); }
}

/**
 * 对 data 里若干关键字段提取为 highlights（只取最常用的几个，避免信息过载）
 */
function extractDataHighlights(data) {
    if (!data || typeof data !== 'object') return [];
    const priority = [
        'result', 'method', 'output', 'status', 'status_reason', 'progress',
        'job_number', 'temperature', 'working_voltage', 'electric_supply_voltage',
        'cover_state', 'drone_in_dock', 'drone_charge_state', 'alarm_state',
        'environment_temperature', 'environment_humidity', 'wind_speed', 'rainfall',
        'flighttask_step_code', 'live_status'
    ];
    const out = [];
    for (const k of priority) {
        if (Object.prototype.hasOwnProperty.call(data, k)) {
            const label = DOCK3_FIELD_LABEL[k] || k;
            out.push({ label, value: truncateVal(data[k]) });
            if (out.length >= 6) break;
        }
    }
    return out;
}

// ---------- 插件入口 ----------
module.exports = {
    activate(ctx) {
        ctx.log('DJI 上云 API 插件已激活');
    },

    /** 动态 sender：每次调用生成新 uuid / ts 作为默认值（用户仍可改） */
    senders: () => {
        const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomUUID();
        const now = Date.now();
        const mk = (id, name, group, action, extraData = {}) => ({
            id,
            name,
            group,
            topic: 'thing/product/{sn}/services',
            payloadTemplate: JSON.stringify({
                tid: `{tid}`,
                bid: `{bid}`,
                timestamp: `{ts}__NUM__`,
                method: action.startsWith('debug_') ? 'debug_mode_open' : action,
                data: action.startsWith('debug_')
                    ? Object.assign({ action: action.replace(/^debug_/, '') }, extraData)
                    : extraData
            }).replace('"{ts}__NUM__"', '{ts}'), // 让 timestamp 成为数字而非字符串
            qos: 1,
            params: [
                { key: 'sn', label: '机场 SN', required: true, placeholder: '例 8UUXNCJ00A0XWG' },
                { key: 'tid', label: 'tid（请求标识）', default: uuid },
                { key: 'bid', label: 'bid（业务流水）', default: uuid },
                { key: 'ts', label: 'timestamp (ms)', type: 'number', default: now }
            ]
        });

        return [
            mk('debug.drone_open', '🛩️ 开启飞机', '机场调试', 'debug_drone_open'),
            mk('debug.drone_close', '🛬 关闭飞机', '机场调试', 'debug_drone_close'),
            mk('debug.cover_open', '📤 舱盖打开', '机场调试', 'debug_cover_open'),
            mk('debug.cover_close', '📥 舱盖关闭', '机场调试', 'debug_cover_close'),
            mk('debug.putter_open', '⬆️ 推杆展开', '机场调试', 'debug_putter_open'),
            mk('debug.putter_close', '⬇️ 推杆收回', '机场调试', 'debug_putter_close'),
            mk('debug.charge_open', '🔌 充电开启', '机场调试', 'debug_charge_open'),
            mk('debug.charge_close', '🔋 充电关闭', '机场调试', 'debug_charge_close'),
            mk('control.device_reboot', '🔄 机场重启', '机场控制', 'device_reboot'),
            mk('control.drone_reboot', '🔁 飞机重启', '机场控制', 'drone_reboot'),
            mk('control.dock_format', '🗑️ 机场格式化', '机场控制', 'dock_format'),
            mk('control.drone_format', '🗑️ 飞机格式化', '机场控制', 'drone_format'),
            mk('live.live_start_push', '📹 开始直播推流', '直播', 'live_start_push', {
                url_type: 1,
                video_id: '',
                video_quality: 2,
                url: ''
            }),
            mk('live.live_stop_push', '⏹️ 停止直播推流', '直播', 'live_stop_push')
        ];
    },

    /** 给主题列表加中文标签 */
    topicLabel(topic) {
        const m = topic.match(TOPIC_RE);
        if (!m) return null;
        const suffix = m[3];
        const label = TOPIC_SUFFIX_LABEL[suffix];
        if (!label) return null;
        return `${DIR_ICON[suffix] || ''} ${label}`.trim();
    },

    /** 解析一条消息 */
    decode(topic, payload) {
        const m = topic.match(TOPIC_RE);
        if (!m) return null;

        const ns = m[1];       // thing / sys
        const sn = m[2];
        const suffix = m[3];
        const suffixLabel = TOPIC_SUFFIX_LABEL[suffix] || suffix;
        const icon = DIR_ICON[suffix] || '📦';

        const body = safeParseJson(payload);
        if (!body || typeof body !== 'object') {
            return {
                summary: `${icon} ${suffixLabel} · ${sn} · (非 JSON)`,
                highlights: [
                    { label: '命名空间', value: ns },
                    { label: 'SN', value: sn },
                    { label: '方向', value: suffixLabel }
                ]
            };
        }

        const method = body.method;
        const parts = [`${icon} ${suffixLabel}`];
        if (method) parts.push(String(method));

        const highlights = [];
        highlights.push({ label: 'SN', value: sn });
        if (method) highlights.push({ label: 'method', value: String(method) });
        if (body.gateway && body.gateway !== sn) highlights.push({ label: 'gateway', value: String(body.gateway) });
        if (body.tid) highlights.push({ label: 'tid', value: String(body.tid) });
        if (body.bid) highlights.push({ label: 'bid', value: String(body.bid) });
        if (body.timestamp) highlights.push({ label: 'timestamp', value: formatTs(body.timestamp) });

        const dataHl = extractDataHighlights(body.data);
        highlights.push(...dataHl);

        return {
            summary: parts.join(' · ') + ` · ${sn}`,
            highlights,
            topicLabel: `${icon} ${suffixLabel}`,
            tree: body
        };
    }
};
