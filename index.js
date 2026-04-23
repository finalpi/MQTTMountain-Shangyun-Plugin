'use strict';

const crypto = require('node:crypto');

const TOPIC_RE = /^(thing|sys)\/product\/([^/]+)\/(.+)$/;

const TOPIC_SUFFIX_LABEL = {
    state: '状态上报',
    state_reply: '状态应答',
    osd: 'OSD 实时推送',
    osd_reply: 'OSD 应答',
    events: '事件上报',
    events_reply: '事件应答',
    services: '下行指令',
    services_reply: '指令回调',
    requests: '上行请求',
    requests_reply: '请求应答',
    properties: '属性设置',
    properties_reply: '属性回调',
    status: '设备上线',
    status_reply: '设备上线应答'
};

const DIR_ICON = {
    state: 'STATE',
    state_reply: 'STATE',
    osd: 'OSD',
    osd_reply: 'OSD',
    events: 'EVENT',
    events_reply: 'EVENT',
    services: 'CALL',
    services_reply: 'ACK',
    requests: 'REQ',
    requests_reply: 'ACK',
    properties: 'PROP',
    properties_reply: 'ACK',
    status: 'STATUS',
    status_reply: 'ACK'
};

const DOCK3_FIELD_LABEL = {
    mode_code: '机场状态',
    job_number: '作业次数',
    acc_time: '累计通电时长',
    activation_time: '激活时间',
    maintain_status: '维护状态',
    electric_supply_voltage: '交流供电电压',
    working_voltage: '工作电压',
    working_current: '工作电流',
    acdc_power_input: 'AC/DC 功率输入',
    poe_link_status: 'POE 连接状态',
    poe_power_output: 'POE 功率输出',
    backup_battery: '备份电池',
    deployment_mode: '部署模式',
    drone_in_dock: '机库内无人机',
    drone_charge_state: '无人机充电状态',
    cover_state: '舱盖状态',
    supplement_light_state: '补光灯',
    emergency_stop_state: '急停开关',
    air_conditioner_mode: '空调模式',
    alarm_state: '告警状态',
    putter_state: '推杆状态',
    environment_temperature: '环境温度',
    environment_humidity: '环境湿度',
    temperature: '温度',
    wind_speed: '风速',
    rainfall: '雨量',
    network_state: '网络状态',
    live_status: '直播状态',
    flighttask_step_code: '任务步骤',
    flighttask_progress: '任务进度'
};

const DEBUG_STATE_KEYS = [
    'debug_mode',
    'debug_mode_enable',
    'debug_mode_enabled',
    'debug_mode_status',
    'is_debug_mode',
    'debug_enabled'
];

const MODE_CODE_LABEL = {
    0: '空闲中',
    1: '现场调试',
    2: '远程调试',
    3: '固件升级中',
    4: '作业中',
    5: '待标定'
};

function safeParseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function truncateVal(value, max = 48) {
    if (value == null) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return text.length > max ? `${text.slice(0, max)}...` : text;
}

function formatTs(ts) {
    if (!ts || typeof ts !== 'number') return '';
    try {
        return new Date(ts).toISOString();
    } catch {
        return String(ts);
    }
}

function firstString(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value;
    }
    return undefined;
}

function extractDataHighlights(data) {
    if (!data || typeof data !== 'object') return [];
    const priority = [
        'result', 'method', 'output', 'status', 'status_reason', 'progress',
        'mode_code',
        ...DEBUG_STATE_KEYS,
        'job_number', 'temperature', 'working_voltage', 'electric_supply_voltage',
        'cover_state', 'drone_in_dock', 'drone_charge_state', 'alarm_state',
        'environment_temperature', 'environment_humidity', 'wind_speed', 'rainfall',
        'flighttask_step_code', 'live_status'
    ];
    const out = [];
    for (const key of priority) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        out.push({ label: DOCK3_FIELD_LABEL[key] || key, value: truncateVal(data[key]) });
        if (out.length >= 6) break;
    }
    return out;
}

function findModeCode(input, seen = new Set()) {
    if (!input || typeof input !== 'object' || seen.has(input)) return null;
    seen.add(input);
    for (const [key, value] of Object.entries(input)) {
        if (key === 'mode_code') {
            if (typeof value === 'number') return value;
            if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
                return Number(value);
            }
        }
        if (value && typeof value === 'object') {
            const nested = findModeCode(value, seen);
            if (nested != null) return nested;
        }
    }
    return null;
}

function inferDroneSn(body, topicSn) {
    const data = body && typeof body.data === 'object' ? body.data : {};
    const droneSn = firstString(
        body.sub_device,
        body.subDevice,
        body.drone_sn,
        body.droneSn,
        data.drone_sn,
        data.droneSn,
        data.sub_device,
        data.subDevice
    );
    if (droneSn) return droneSn;
    if (typeof body.gateway === 'string' && body.gateway !== topicSn) return topicSn;
    return undefined;
}

function normalizeDebugState(value) {
    if (typeof value === 'boolean') return value ? 'enabled' : 'disabled';
    if (typeof value === 'number') {
        if (value === 1) return 'enabled';
        if (value === 0) return 'disabled';
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'on', 'open', 'opened', 'enable', 'enabled'].includes(normalized)) return 'enabled';
        if (['0', 'false', 'off', 'close', 'closed', 'disable', 'disabled'].includes(normalized)) return 'disabled';
    }
    return null;
}

function findDebugStateField(input, seen = new Set()) {
    if (!input || typeof input !== 'object' || seen.has(input)) return null;
    seen.add(input);
    for (const [key, value] of Object.entries(input)) {
        if (DEBUG_STATE_KEYS.includes(key)) {
            const state = normalizeDebugState(value);
            if (state) return { state, source: key };
        }
        if (value && typeof value === 'object') {
            const nested = findDebugStateField(value, seen);
            if (nested) return nested;
        }
    }
    return null;
}

function inferDebugState(body) {
    const modeCode = findModeCode(body);
    if (modeCode != null) {
        return {
            state: modeCode === 2 ? 'enabled' : 'disabled',
            source: 'mode_code',
            modeCode
        };
    }
    const fromField = findDebugStateField(body);
    if (fromField) return fromField;
    if (body.method === 'debug_mode_open') return { state: 'enabled', source: 'method' };
    if (body.method === 'debug_mode_close') return { state: 'disabled', source: 'method' };
    return null;
}

function inferMessageMeta(namespace, topicSn, suffix, body) {
    const isReply = suffix.endsWith('_reply');
    const gatewaySn = typeof body.gateway === 'string' ? body.gateway : undefined;
    const airportSn = firstString(gatewaySn, topicSn);
    const droneSn = inferDroneSn(body, topicSn);

    let messageKind = 'telemetry';
    if (suffix.includes('event')) messageKind = isReply ? 'reply' : 'event';
    else if (suffix.includes('service') || suffix.includes('request') || suffix.includes('property')) {
        messageKind = isReply ? 'reply' : 'request';
    } else if (suffix.includes('status')) messageKind = 'status';
    else if (isReply) messageKind = 'reply';

    let direction = 'up';
    if (suffix.startsWith('services') || suffix.startsWith('properties')) direction = 'down';
    if (suffix.startsWith('requests')) direction = 'up';
    if (isReply && (suffix.startsWith('services') || suffix.startsWith('properties'))) direction = 'up';

    const debugInfo = inferDebugState(body);

    return {
        family: 'dji-shangyun',
        namespace,
        airportSn,
        droneSn,
        gatewaySn: gatewaySn || airportSn,
        deviceSn: droneSn || topicSn,
        topicKind: suffix,
        messageKind,
        direction,
        method: typeof body.method === 'string' ? body.method : undefined,
        tid: typeof body.tid === 'string' ? body.tid : undefined,
        bid: typeof body.bid === 'string' ? body.bid : undefined,
        isReply,
        debugState: debugInfo?.state,
        debugStateSource: debugInfo?.source,
        modeCode: debugInfo?.modeCode
    };
}

function createDebugSender(id, name, method) {
    const uuid = crypto.randomUUID();
    const now = Date.now();
    return {
        id,
        name,
        group: '调试模式',
        topic: 'thing/product/{airportSn}/services',
        payloadTemplate: JSON.stringify({
            tid: '{tid}',
            bid: '{bid}',
            timestamp: '{ts}__NUM__',
            method
        }).replace('"{ts}__NUM__"', '{ts}'),
        qos: 1,
        params: [
            { key: 'airportSn', label: '机场 SN', required: true, placeholder: '例如 8UUXNCJ00A0XWG' },
            { key: 'tid', label: 'tid', default: uuid },
            { key: 'bid', label: 'bid', default: uuid },
            { key: 'ts', label: 'timestamp (ms)', type: 'number', default: now }
        ]
    };
}

function createCommandSender({ id, name, method, group = '快捷控制' }) {
    const uuid = crypto.randomUUID();
    const now = Date.now();
    const params = [
        { key: 'airportSn', label: '机场 SN', required: true, placeholder: '例如 8UUXNCJ00A0XWG' }
    ];
    params.push(
        { key: 'tid', label: 'tid', default: uuid },
        { key: 'bid', label: 'bid', default: uuid },
        { key: 'ts', label: 'timestamp (ms)', type: 'number', default: now }
    );

    const payload = {
        tid: '{tid}',
        bid: '{bid}',
        timestamp: '{ts}__NUM__',
        method
    };

    return {
        id,
        name,
        group,
        topic: 'thing/product/{airportSn}/services',
        payloadTemplate: JSON.stringify(payload).replace('"{ts}__NUM__"', '{ts}'),
        qos: 1,
        params
    };
}

module.exports = {
    activate(ctx) {
        ctx.log('DJI 上云插件已激活');
    },

    senders: () => ([
        createCommandSender({ id: 'control.drone.power_on', name: '飞行器开机', method: 'debug_drone_open' }),
        createCommandSender({ id: 'control.dock.reboot', name: '机场重启', method: 'device_reboot' }),
        createCommandSender({ id: 'control.drone.power_off', name: '飞行器关机', method: 'debug_drone_close' }),
        createCommandSender({ id: 'control.cover.open', name: '打开舱盖', method: 'debug_cover_open' }),
        createCommandSender({ id: 'control.cover.close', name: '关闭舱盖', method: 'debug_cover_close' }),
        createDebugSender('debug.mode.open', '开启 Debug 模式', 'debug_mode_open'),
        createDebugSender('debug.mode.close', '关闭 Debug 模式', 'debug_mode_close')
    ]),

    topicLabel(topic) {
        const match = topic.match(TOPIC_RE);
        if (!match) return null;
        const suffix = match[3];
        const label = TOPIC_SUFFIX_LABEL[suffix];
        if (!label) return null;
        return `${DIR_ICON[suffix] || 'MSG'} ${label}`.trim();
    },

    decode(topic, payload) {
        const match = topic.match(TOPIC_RE);
        if (!match) return null;

        const namespace = match[1];
        const sn = match[2];
        const suffix = match[3];
        const suffixLabel = TOPIC_SUFFIX_LABEL[suffix] || suffix;
        const icon = DIR_ICON[suffix] || 'MSG';
        const body = safeParseJson(payload);

        if (!body || typeof body !== 'object') {
            return {
                summary: `${icon} ${suffixLabel} | ${sn} | non-json`,
                highlights: [
                    { label: 'namespace', value: namespace },
                    { label: 'sn', value: sn },
                    { label: 'topic', value: suffixLabel }
                ],
                meta: {
                    family: 'dji-shangyun',
                    airportSn: sn,
                    gatewaySn: sn,
                    deviceSn: sn,
                    topicKind: suffix,
                    messageKind: 'telemetry',
                    direction: suffix.startsWith('services') ? 'down' : 'up',
                    isReply: suffix.endsWith('_reply')
                }
            };
        }

        const parts = [`${icon} ${suffixLabel}`];
        if (body.method) parts.push(String(body.method));

        const highlights = [{ label: 'SN', value: sn }];
        if (body.method) highlights.push({ label: 'method', value: String(body.method) });
        if (body.gateway && body.gateway !== sn) highlights.push({ label: 'gateway', value: String(body.gateway) });
        if (body.tid) highlights.push({ label: 'tid', value: String(body.tid) });
        if (body.bid) highlights.push({ label: 'bid', value: String(body.bid) });
        if (body.timestamp) highlights.push({ label: 'timestamp', value: formatTs(body.timestamp) });

        const meta = inferMessageMeta(namespace, sn, suffix, body);
        if (meta.debugState) {
            highlights.push({
                label: 'debug',
                value: meta.debugState === 'enabled' ? 'enabled' : 'disabled'
            });
        }
        if (typeof meta.modeCode === 'number') {
            highlights.push({
                label: '机场状态',
                value: `${meta.modeCode} ${MODE_CODE_LABEL[meta.modeCode] || ''}`.trim()
            });
        }
        highlights.push(...extractDataHighlights(body.data));

        const rememberParams = {};
        if (sn) rememberParams.sn = sn;
        if (meta.airportSn) rememberParams.airportSn = meta.airportSn;
        if (meta.droneSn) rememberParams.droneSn = meta.droneSn;
        if (meta.gatewaySn) rememberParams.gateway = meta.gatewaySn;

        return {
            summary: `${parts.join(' | ')} | ${sn}`,
            highlights,
            topicLabel: `${icon} ${suffixLabel}`,
            rememberParams,
            tree: body,
            meta
        };
    }
};
