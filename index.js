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
    'drc/down': '遥控下行',
    'drc/up': '遥控回传',
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
    'drc/down': 'DRC',
    'drc/up': 'ACK',
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

const AIRCRAFT_M3D_FIELD_LABEL = {
    best_link_gateway: '最佳图传连接网关 SN',
    wireless_link_topo: '图传连接拓扑',
    secret_code: '加密码',
    center_node: '飞行器对频信息',
    sdr_id: '扰码信息',
    sn: '设备 SN',
    leaf_nodes: '当前连接机场/遥控器对频信息',
    control_source_index: '控制源索引',
    cameras: '飞行器相机信息',
    remain_photo_num: '剩余可拍照片数',
    remain_record_duration: '剩余录像时长',
    record_time: '录像时长',
    payload_index: '负载索引',
    camera_mode: '相机模式',
    photo_state: '拍照状态',
    screen_split_enable: '分屏开关',
    recording_state: '录像状态',
    zoom_factor: '变焦倍率',
    ir_zoom_factor: '红外变焦倍率',
    liveview_world_region: '直播视场区域',
    left: '左边界',
    top: '上边界',
    right: '右边界',
    bottom: '下边界',
    photo_storage_settings: '照片存储设置',
    video_storage_settings: '视频存储设置',
    wide_exposure_mode: '广角曝光模式',
    wide_iso: '广角 ISO',
    wide_shutter_speed: '广角快门速度',
    wide_exposure_value: '广角曝光补偿',
    zoom_exposure_mode: '变焦曝光模式',
    zoom_iso: '变焦 ISO',
    zoom_shutter_speed: '变焦快门速度',
    zoom_exposure_value: '变焦曝光补偿',
    zoom_focus_mode: '变焦对焦模式',
    zoom_focus_value: '变焦对焦值',
    zoom_max_focus_value: '变焦最大对焦值',
    zoom_min_focus_value: '变焦最小对焦值',
    zoom_calibrate_farthest_focus_value: '变焦最远清晰对焦值',
    zoom_calibrate_nearest_focus_value: '变焦最近清晰对焦值',
    zoom_focus_state: '变焦对焦状态',
    ir_metering_mode: '红外测温模式',
    ir_metering_point: '红外点测温信息',
    x: 'X 坐标',
    y: 'Y 坐标',
    temperature: '温度',
    ir_metering_area: '红外区域测温信息',
    width: '宽度',
    height: '高度',
    aver_temperature: '平均温度',
    min_temperature_point: '最低温点',
    max_temperature_point: '最高温点',
    flysafe_database_version: '飞行安全数据库版本',
    offline_map_enable: '离线地图开关',
    dongle_infos: '4G Dongle 信息',
    imei: 'Dongle IMEI',
    dongle_type: 'Dongle 类型',
    eid: 'Dongle EID',
    esim_activate_state: 'eSIM 激活状态',
    sim_card_state: 'SIM 卡状态',
    sim_slot: 'SIM 卡槽启用状态',
    esim_infos: 'eSIM 信息',
    telecom_operator: '运营商',
    enabled: '启用状态',
    iccid: 'SIM ICCID',
    sim_info: 'SIM 卡信息',
    sim_type: 'SIM 卡类型',
    current_rth_mode: '当前返航高度模式',
    rth_mode: '返航高度模式设置',
    obstacle_avoidance: '飞行器避障感知状态',
    horizon: '水平避障感知',
    upside: '上视避障感知',
    downside: '下视避障感知',
    is_near_area_limit: '是否接近 GEO 区域',
    is_near_height_limit: '是否接近限高',
    height_limit: '飞行器限高',
    night_lights_state: '夜航灯状态',
    activation_time: '飞行器激活时间',
    maintain_status: '维护信息',
    maintain_status_array: '维护信息列表',
    state: '状态',
    last_maintain_type: '上次维护类型',
    last_maintain_time: '上次维护时间',
    last_maintain_flight_time: '上次维护飞行时长',
    last_maintain_flight_sorties: '上次维护飞行架次',
    total_flight_sorties: '累计飞行架次',
    type_subtype_gimbalindex: '负载索引',
    gimbal_pitch: '云台俯仰角',
    gimbal_roll: '云台横滚角',
    gimbal_yaw: '云台偏航角',
    track_id: '追踪 ID',
    position_state: '搜星状态',
    is_fixed: '是否固定',
    quality: '卫星定位质量',
    gps_number: 'GPS 卫星数',
    rtk_number: 'RTK 卫星数',
    storage: '存储容量',
    total: '总容量',
    used: '已用容量',
    battery: '飞行器电池信息',
    capacity_percent: '剩余电量百分比',
    remain_flight_time: '剩余飞行时间',
    return_home_power: '返航所需电量百分比',
    landing_power: '迫降电量百分比',
    batteries: '电池详情',
    index: '电池序号',
    type: '类型',
    sub_type: '子类型',
    firmware_version: '固件版本',
    loop_times: '电池循环次数',
    voltage: '电压',
    high_voltage_storage_days: '高电压存储天数',
    total_flight_distance: '累计飞行里程',
    total_flight_time: '累计飞行时间',
    serious_low_battery_warning_threshold: '严重低电量告警阈值',
    low_battery_warning_threshold: '低电量告警阈值',
    control_source: '当前控制源',
    wind_direction: '当前风向',
    wind_speed: '风速',
    home_distance: '距返航点距离',
    home_latitude: '返航点纬度',
    home_longitude: '返航点经度',
    attitude_head: '偏航角',
    attitude_roll: '横滚角',
    attitude_pitch: '俯仰角',
    elevation: '相对起飞点高度',
    latitude: '当前纬度',
    longitude: '当前经度',
    vertical_speed: '垂直速度',
    horizontal_speed: '水平速度',
    firmware_upgrade_status: '固件升级状态',
    compatible_status: '固件一致性状态',
    gear: '挡位',
    mode_code_reason: '进入当前飞行状态原因',
    commander_flight_height: '指点飞行高度',
    commander_flight_mode: '指点飞行模式设置',
    commander_mode_lost_action: '指点飞行失控动作',
    camera_watermark_settings: '相机水印设置',
    global_enable: '水印总开关',
    drone_type_enable: '飞行器型号显示开关',
    drone_sn_enable: '飞行器 SN 显示开关',
    datetime_enable: '日期时间显示开关',
    gps_enable: '经纬度和高度显示开关',
    user_custom_string_enable: '自定义文字显示开关',
    user_custom_string: '自定义文字内容',
    layout: '水印位置',
    mode_code: '飞行器状态'
};

const DOCK2_FIELD_LABEL = {
    home_position_is_valid: '返航点位置有效性',
    heading: '机场朝向角',
    rtcm_info: '机场 RTK 校准源',
    mount_point: '网络 RTK 挂载点',
    port: '网络端口',
    host: '网络主机',
    rtcm_device_type: 'RTCM 设备类型',
    source_type: '校准类型',
    air_conditioner: '机场空调工作状态',
    air_conditioner_state: '机场空调状态',
    switch_time: '状态切换剩余等待时间',
    air_transfer_enable: '照片快传',
    silent_mode: '机场静音模式',
    user_experience_improvement: '用户体验改进计划',
    drone_battery_maintenance_info: '飞行器电池维护信息',
    maintenance_state: '维护状态',
    maintenance_time_left: '电池维护剩余时间',
    heat_state: '电池加热/保温状态',
    last_maintain_work_sorties: '上次维护作业架次',
    is_calibration: '是否已校准',
    emergency_stop_state: '急停按钮状态',
    drone_charge_state: '飞行器充电状态',
    backup_battery: '机场备用电池信息',
    switch: '开关',
    alarm_state: '机场声光报警状态',
    battery_store_mode: '电池运行模式',
    alternate_land_point: '备降点',
    safe_land_height: '安全降落高度',
    is_configured: '是否已配置',
    first_power_on: '首次上电时间',
    humidity: '机场舱内湿度',
    environment_temperature: '环境温度',
    rainfall: '雨量',
    live_capacity: '网关直播能力',
    available_video_number: '可选直播码率数量',
    coexist_video_number_max: '最大同时直播路数',
    device_list: '可选视频设备源列表',
    camera_list: '设备相机列表',
    camera_index: '相机索引',
    video_list: '可选视频流列表',
    video_index: '视频流索引',
    video_type: '视频类型',
    switchable_video_types: '可切换视频类型',
    live_status: '网关当前直播状态',
    video_id: '直播标识',
    video_quality: '直播画质',
    status: '直播状态',
    error_status: '错误码',
    wireless_link: '图传链路',
    dongle_number: '飞行器 Dongle 数量',
    '4g_link_state': '4G 链路连接状态',
    sdr_link_state: 'SDR 链路连接状态',
    link_workmode: '机场图传链路模式',
    sdr_quality: 'SDR 信号质量',
    '4g_quality': '4G 综合信号质量',
    '4g_uav_quality': '空侧 4G 信号质量',
    '4g_gnd_quality': '地面侧 4G 信号质量',
    sdr_freq_band: 'SDR 频段',
    '4g_freq_band': '4G 频段',
    media_file_detail: '媒体文件上传详情',
    remain_upload: '待上传数量',
    job_number: '机场累计作业次数',
    drone_in_dock: '飞行器是否在舱',
    network_state: '网络状态',
    quality: '质量',
    rate: '网络速率',
    supplement_light_state: '补光灯状态',
    cover_state: '舱盖状态',
    sub_device: '子设备状态',
    device_sn: '子设备 SN',
    device_model_key: '子设备枚举值',
    device_online_status: '飞行器在舱上电状态',
    device_paired: '飞行器是否与机场配对',
    flighttask_step_code: '机场任务状态',
    mode_code: '机场状态',
    latitude: '机场纬度',
    longitude: '机场经度'
};

const FIELD_LABEL = {
    ...DOCK3_FIELD_LABEL,
    ...AIRCRAFT_M3D_FIELD_LABEL,
    ...DOCK2_FIELD_LABEL
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

const COMMON_ENUM_LABEL = {
    0: '禁用',
    1: '启用',
    'false': '未使用',
    'true': '使用中'
};

const DOCK2_FIELD_SPEC = {
    home_position_is_valid: { enum: { 0: '无效', 1: '有效' } },
    heading: { unit: '°' },
    rtcm_device_type: { enum: { 1: '机场' } },
    source_type: { enum: { 0: '未标定', 1: '自收敛标定', 2: '手动标定', 3: '网络 RTK 标定' } },
    air_conditioner_state: { enum: { 0: '空闲模式', 1: '制冷模式', 2: '制热模式', 3: '除湿模式', 4: '制冷退出模式', 5: '制热退出模式', 6: '除湿退出模式', 7: '制冷准备模式', 8: '制热准备模式', 9: '除湿准备模式' } },
    switch_time: { unit: 's' },
    air_transfer_enable: { enum: { 0: '关闭', 1: '开启' } },
    silent_mode: { enum: { 0: '非静音模式', 1: '静音模式' } },
    user_experience_improvement: { enum: { 0: '初始状态', 1: '拒绝加入用户体验改进计划', 2: '同意加入用户体验改进计划' } },
    dongle_type: { enum: { 6: '旧款 Dongle', 10: '支持 eSIM 的新款 Dongle' } },
    esim_activate_state: { enum: { 0: '未激活', 1: '已激活' } },
    sim_card_state: { enum: { 0: '未插入', 1: '已插入' } },
    sim_slot: { enum: { 0: '未知', 1: '实体 SIM 卡', 2: 'eSIM' } },
    telecom_operator: { enum: { 0: '未知', 1: '移动', 2: '联通', 3: '电信' } },
    enabled: { enum: { 'false': '未使用', 'true': '使用中' } },
    sim_type: { enum: { 0: '未知', 1: '其他普通 SIM 卡', 2: '三网卡' } },
    maintenance_state: { enum: { 0: '无需维护', 1: '等待维护', 2: '维护中' } },
    maintenance_time_left: { unit: 'h' },
    heat_state: { enum: { 0: '电池未加热或保温', 1: '电池加热中', 2: '电池保温中' } },
    voltage: { unit: 'mV' },
    temperature: { unit: '°C' },
    last_maintain_time: { unit: 's' },
    is_calibration: { enum: { 0: '未校准', 1: '已校准' } },
    is_fixed: { enum: { 0: '未开始', 1: '固定中', 2: '固定成功', 3: '固定失败' } },
    quality: { enum: { 1: '1 档', 2: '2 档', 3: '3 档', 4: '4 档', 5: '5 档', 10: 'RTK 固定' } },
    emergency_stop_state: { enum: COMMON_ENUM_LABEL },
    switch: { enum: COMMON_ENUM_LABEL },
    alarm_state: { enum: COMMON_ENUM_LABEL },
    battery_store_mode: { enum: { 1: '计划模式', 2: '待命模式' } },
    activation_time: { unit: 's' },
    height: { unit: 'm' },
    is_configured: { enum: { 0: '未设置', 1: '已设置' } },
    compatible_status: { enum: { 0: '无需一致性升级', 1: '需要一致性升级' } },
    acc_time: { unit: 's' },
    first_power_on: { unit: 'ms' },
    total: { unit: 'KB' },
    used: { unit: 'KB' },
    working_current: { unit: 'mA' },
    working_voltage: { unit: 'mV' },
    humidity: { unit: '%RH' },
    environment_temperature: { unit: '°C' },
    wind_speed: { unit: 'm/s' },
    rainfall: { enum: { 0: '无雨', 1: '小雨', 2: '中雨', 3: '大雨' } },
    video_quality: { enum: { 0: '自适应', 1: '流畅', 2: '标清', 3: '高清', 4: '超高清' } },
    status: { enum: { 0: '未直播', 1: '直播中' } },
    '4g_link_state': { enum: { 0: '断开', 1: '连接' } },
    sdr_link_state: { enum: { 0: '断开', 1: '连接' } },
    link_workmode: { enum: { 0: 'SDR 模式', 1: '4G 融合模式' } },
    job_number: { unit: '次' },
    drone_in_dock: { enum: { 0: '舱外', 1: '舱内' } },
    type: { enum: { 1: '4G', 2: '以太网' } },
    rate: { unit: 'KB/s' },
    supplement_light_state: { enum: { 0: '关闭', 1: '开启' } },
    cover_state: { enum: { 0: '关闭', 1: '开启', 2: '半开', 3: '舱盖状态异常' } },
    device_online_status: { enum: { 0: '关机', 1: '开机' } },
    device_paired: { enum: { 0: '未配对', 1: '已配对' } },
    flighttask_step_code: { enum: { 0: '作业准备', 1: '飞行作业中', 2: '作业后状态恢复', 3: '自定义飞行区更新中', 4: '地形障碍更新中', 5: '任务空闲', 255: '飞行器异常', 256: '未知状态' } },
    mode_code: { enum: { 0: '空闲', 1: '现场调试', 2: '远程调试', 3: '固件升级中', 4: '作业中' } }
};

const AIRCRAFT_M3D_FIELD_SPEC = {
    control_source_index: { unit: '' },
    remain_record_duration: { unit: 's' },
    record_time: { unit: 's' },
    camera_mode: { enum: { 0: '拍照中', 1: '录像中', 2: '智能低光', 3: '全景拍摄' } },
    photo_state: { enum: { 0: '空闲', 1: '拍照中' } },
    screen_split_enable: { enum: { 0: '关闭分屏', 1: '开启分屏' } },
    recording_state: { enum: { 0: '空闲', 1: '录像中' } },
    wide_exposure_mode: { enum: { 1: '自动', 2: '快门优先', 3: '光圈优先', 4: '手动曝光' } },
    zoom_exposure_mode: { enum: { 1: '自动', 2: '快门优先', 3: '光圈优先', 4: '手动曝光' } },
    wide_iso: { enum: { 0: '自动', 1: '自动（高感）', 2: '50', 3: '100', 4: '200', 5: '400', 6: '800', 7: '1600', 8: '3200', 9: '6400', 10: '12800', 11: '25600', 255: '固定' } },
    zoom_iso: { enum: { 0: '自动', 1: '自动（高感）', 2: '50', 3: '100', 4: '200', 5: '400', 6: '800', 7: '1600', 8: '3200', 9: '6400', 10: '12800', 11: '25600', 255: '固定' } },
    zoom_focus_mode: { enum: { 0: '手动对焦', 1: '单次自动对焦', 2: '连续自动对焦' } },
    zoom_focus_state: { enum: { 0: '空闲', 1: '对焦中', 2: '对焦成功', 3: '对焦失败' } },
    ir_metering_mode: { enum: { 0: '关闭红外测温', 1: '点测温', 2: '区域测温' } },
    offline_map_enable: { enum: COMMON_ENUM_LABEL },
    current_rth_mode: { enum: { 0: '智能高度', 1: '预设高度' } },
    rth_mode: { enum: { 0: '智能高度', 1: '预设高度' } },
    horizon: { enum: COMMON_ENUM_LABEL },
    upside: { enum: COMMON_ENUM_LABEL },
    downside: { enum: COMMON_ENUM_LABEL },
    is_near_area_limit: { enum: { 0: '未接近 GEO 区域', 1: '接近 GEO 区域' } },
    is_near_height_limit: { enum: { 0: '未接近限高', 1: '接近限高' } },
    height_limit: { unit: 'm' },
    night_lights_state: { enum: { 0: '关闭', 1: '开启' } },
    last_maintain_flight_time: { unit: 'h' },
    gimbal_pitch: { unit: '°' },
    gimbal_roll: { unit: '°' },
    gimbal_yaw: { unit: '°' },
    capacity_percent: { unit: '%' },
    remain_flight_time: { unit: 's' },
    return_home_power: { unit: '%' },
    landing_power: { unit: '%' },
    high_voltage_storage_days: { unit: 'day' },
    total_flight_distance: { unit: 'm' },
    total_flight_time: { unit: 's' },
    serious_low_battery_warning_threshold: { unit: '%' },
    low_battery_warning_threshold: { unit: '%' },
    wind_direction: { enum: { 1: '正北', 2: '东北', 3: '正东', 4: '东南', 5: '正南', 6: '西南', 7: '正西', 8: '西北' } },
    vertical_speed: { unit: 'm/s' },
    firmware_upgrade_status: { enum: { 0: '未升级', 1: '升级中' } },
    gear: { enum: { 0: 'A 挡', 1: 'P 挡', 2: 'NAV 挡', 3: 'FPV 挡', 4: 'FARM 挡', 5: 'S 挡', 6: 'F 挡', 7: 'M 挡', 8: 'G 挡', 9: 'T 挡' } },
    mode_code_reason: { enum: { 0: '无含义', 1: '电量不足', 2: '电压不足', 3: '严重低电压', 4: '遥控器按键请求', 5: 'App 请求', 6: '遥控器信号丢失', 7: '外部设备触发', 8: '进入机场 GEO 区降落', 9: '返航触发但离返航点太近', 10: '返航触发但离返航点太远', 11: '执行航点任务时请求', 12: '返航阶段到达返航点上方后请求', 13: '二段下降限制后继续下降', 14: '外部设备强制突破低空保护', 15: '附近有穿越飞行请求', 16: '高度控制失败', 17: '智能低电量返航后进入', 18: 'AP 控制飞行模式', 19: '硬件异常', 20: '防撞保护结束', 21: '返航取消', 22: '返航遇障', 23: '机场场景强风触发' } },
    commander_flight_height: { unit: 'm' },
    commander_flight_mode: { enum: { 0: '最优高度飞行', 1: '预设高度飞行' } },
    commander_mode_lost_action: { enum: { 0: '继续指点飞行任务', 1: '退出指点飞行并执行常规失控行为' } },
    global_enable: { enum: COMMON_ENUM_LABEL },
    drone_type_enable: { enum: COMMON_ENUM_LABEL },
    drone_sn_enable: { enum: COMMON_ENUM_LABEL },
    datetime_enable: { enum: COMMON_ENUM_LABEL },
    gps_enable: { enum: COMMON_ENUM_LABEL },
    user_custom_string_enable: { enum: COMMON_ENUM_LABEL },
    layout: { enum: { 0: '左上', 1: '左下', 2: '右上', 3: '右下' } },
    mode_code: { enum: { 0: '待机', 1: '起飞准备', 2: '起飞准备完成', 3: '手动飞行', 4: '自动起飞', 5: '航线飞行', 6: '全景拍摄', 7: '智能跟踪', 8: 'ADS-B 躲避', 9: '自动返航', 10: '自动降落', 11: '强制降落', 12: '三桨叶降落', 13: '升级中', 14: '未连接', 15: 'APAS', 16: '虚拟摇杆状态', 17: '直播飞控', 18: '机载 RTK 固定模式', 19: '机场地址选择中' } }
};

const PATH_FIELD_SPEC = [
    { key: 'state', path: 'maintain_status_array', spec: { enum: { 0: '无维护', 1: '有维护' } } },
    { key: 'state', path: 'drone_charge_state', spec: { enum: { 0: '空闲', 1: '充电中' } } },
    { key: 'quality', path: 'network_state', spec: { enum: { 0: '无信号', 1: '差', 2: '较差', 3: '中等', 4: '较好', 5: '好' } } },
    { key: 'quality', path: 'position_state', spec: { enum: { 1: '1 档', 2: '2 档', 3: '3 档', 4: '4 档', 5: '5 档', 10: 'RTK 固定' } } },
    { key: 'last_maintain_type', path: 'maintain_status_array', device: 'dock', spec: { enum: { 0: '无维护', 17: '机场常规维护', 18: '机场深度维护' } } },
    { key: 'last_maintain_type', path: 'maintain_status_array', device: 'aircraft', spec: { enum: { 1: '飞行器基础维护', 2: '飞行器常规维护', 3: '飞行器深度维护' } } },
    { key: 'index', path: 'batteries', device: 'dock', spec: { enum: { 0: '左电池', 1: '右电池' } } }
];

function uuidParam(key, defaultValue) {
    return { key, label: key, default: defaultValue, actions: [{ id: 'randomUuid', label: '随机' }] };
}

function timestampParam(defaultValue) {
    return {
        key: 'ts',
        label: 'timestamp (ms)',
        type: 'number',
        default: defaultValue,
        actions: [{ id: 'currentTimestamp', label: '当前时间' }]
    };
}

function randomUuid() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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

function fieldLabel(key) {
    return FIELD_LABEL[key] || key;
}

function fieldLabelForDevice(key, topicSn) {
    const primary = looksLikeDroneSn(topicSn) ? AIRCRAFT_M3D_FIELD_LABEL : DOCK2_FIELD_LABEL;
    return primary[key] || FIELD_LABEL[key] || key;
}

function matchPathSpec(key, path, topicSn) {
    const device = looksLikeDroneSn(topicSn) ? 'aircraft' : 'dock';
    return PATH_FIELD_SPEC.find((item) => {
        if (item.key !== key || !path.includes(item.path)) return false;
        return !item.device || item.device === device;
    })?.spec || null;
}

function fieldSpecForDevice(key, path, topicSn) {
    const pathSpec = matchPathSpec(key, path, topicSn);
    if (pathSpec) return pathSpec;
    const primary = looksLikeDroneSn(topicSn) ? AIRCRAFT_M3D_FIELD_SPEC : DOCK2_FIELD_SPEC;
    return primary[key] || DOCK2_FIELD_SPEC[key] || AIRCRAFT_M3D_FIELD_SPEC[key] || null;
}

function enumText(spec, value) {
    const enumMap = spec?.enum;
    if (!enumMap) return '';
    return enumMap[String(value)] || enumMap[value] || '';
}

function displayFieldValue(key, value, path, topicSn) {
    if (value === null) return 'null';
    if (typeof value === 'undefined') return 'undefined';
    if (typeof value === 'object') return '';
    const raw = truncateVal(value, 120);
    const spec = fieldSpecForDevice(key, path, topicSn);
    const meaning = enumText(spec, value);
    if (meaning) return `${raw}（${meaning}）`;
    if (spec?.unit) return `${raw} ${spec.unit}`;
    return raw;
}

function collectFieldValues(input, path = '$.data', out = [], seen = new Set(), topicSn = '') {
    if (!input || typeof input !== 'object' || out.length >= 200) return out;
    if (seen.has(input)) return out;
    seen.add(input);
    if (Array.isArray(input)) {
        input.slice(0, 20).forEach((item, index) => collectFieldValues(item, `${path}[${index}]`, out, seen, topicSn));
        return out;
    }
    for (const [key, value] of Object.entries(input)) {
        const label = fieldLabelForDevice(key, topicSn);
        const nextPath = `${path}.${key}`;
        if (label && label !== key && (!value || typeof value !== 'object')) {
            out.push({ path: nextPath, key, label, value: displayFieldValue(key, value, nextPath, topicSn) });
        }
        if (value && typeof value === 'object') collectFieldValues(value, nextPath, out, seen, topicSn);
        if (out.length >= 200) break;
    }
    return out;
}

function firstString(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value;
    }
    return undefined;
}

function looksLikeAirportSn(value) {
    return typeof value === 'string' && /^[A-Z0-9]{14}$/.test(value.trim());
}

function looksLikeDroneSn(value) {
    return typeof value === 'string' && /^[A-Z0-9]{18,22}$/.test(value.trim());
}

function extractDataHighlights(data, topicSn = '') {
    if (!data || typeof data !== 'object') return [];
    const priority = [
        'result', 'method', 'output', 'status', 'status_reason', 'progress',
        'mode_code',
        ...DEBUG_STATE_KEYS,
        'latitude', 'longitude', 'height', 'elevation', 'horizontal_speed', 'vertical_speed',
        'battery', 'capacity_percent', 'remain_flight_time', 'home_distance',
        'attitude_head', 'attitude_roll', 'attitude_pitch',
        'job_number', 'temperature', 'working_voltage', 'electric_supply_voltage',
        'cover_state', 'drone_in_dock', 'drone_charge_state', 'alarm_state',
        'environment_temperature', 'environment_humidity', 'wind_speed', 'rainfall',
        'flighttask_step_code', 'live_status'
    ];
    const out = [];
    for (const key of priority) {
        if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
        if (data[key] && typeof data[key] === 'object') continue;
        out.push({ label: fieldLabelForDevice(key, topicSn), value: displayFieldValue(key, data[key], `$.data.${key}`, topicSn) });
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
    const bodySubDevice = body && typeof body.sub_device === 'object' ? body.sub_device : {};
    const dataSubDevice = data && typeof data.sub_device === 'object' ? data.sub_device : {};
    const droneSn = firstString(
        body.sub_device,
        body.subDevice,
        bodySubDevice.device_sn,
        bodySubDevice.deviceSn,
        bodySubDevice.sn,
        body.drone_sn,
        body.droneSn,
        body.device_sn,
        body.deviceSn,
        body.sn,
        data.drone_sn,
        data.droneSn,
        data.sub_device,
        data.subDevice,
        dataSubDevice.device_sn,
        dataSubDevice.deviceSn,
        dataSubDevice.sn,
        data.device_sn,
        data.deviceSn,
        data.sn
    );
    if (droneSn) return droneSn;
    if (looksLikeDroneSn(topicSn)) return topicSn;
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
    const isReply = suffix.endsWith('_reply') || suffix === 'drc/up';
    const droneSn = inferDroneSn(body, topicSn);
    const data = body && typeof body.data === 'object' ? body.data : {};
    const gatewaySn = firstString(
        body.gateway,
        body.gateway_sn,
        body.gatewaySn,
        body.dock_sn,
        body.dockSn,
        data.gateway,
        data.gateway_sn,
        data.gatewaySn,
        data.dock_sn,
        data.dockSn
    );
    const airportSn = firstString(
        gatewaySn,
        looksLikeAirportSn(topicSn) ? topicSn : undefined
    );

    let messageKind = 'telemetry';
    if (suffix.includes('event')) messageKind = isReply ? 'reply' : 'event';
    else if (suffix.startsWith('drc/')) messageKind = isReply ? 'reply' : 'request';
    else if (suffix.includes('service') || suffix.includes('request') || suffix.includes('property')) {
        messageKind = isReply ? 'reply' : 'request';
    } else if (suffix.includes('status')) messageKind = 'status';
    else if (isReply) messageKind = 'reply';

    let direction = 'up';
    if (suffix.startsWith('services') || suffix.startsWith('properties')) direction = 'down';
    if (suffix === 'drc/down') direction = 'down';
    if (suffix === 'drc/up') direction = 'up';
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
        seq: typeof body.seq === 'number' ? body.seq : undefined,
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
            uuidParam('tid', uuid),
            uuidParam('bid', uuid),
            timestampParam(now)
        ]
    };
}

function createServiceSender({ id, name, method, group = '快捷控制', dataParams = [] }) {
    const uuid = crypto.randomUUID();
    const now = Date.now();
    const params = [
        { key: 'airportSn', label: '机场 SN', required: true, placeholder: '例如 8UUXNCJ00A0XWG' }
    ];
    const data = {};
    for (const param of dataParams) {
        params.push(param);
        data[param.key] = `{${param.key}}`;
    }
    params.push(
        uuidParam('tid', uuid),
        uuidParam('bid', uuid),
        timestampParam(now)
    );

    const payload = {
        tid: '{tid}',
        bid: '{bid}',
        timestamp: '{ts}__NUM__',
        method
    };
    if (dataParams.length) payload.data = data;

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

function createReturnHomeSender() {
    const uuid = crypto.randomUUID();
    const now = Date.now();
    return {
        id: 'wayline.return_home',
        name: '一键返航',
        group: '航线控制',
        topic: 'thing/product/{gateway}/services',
        payloadTemplate: JSON.stringify({
            tid: '{tid}',
            bid: '{bid}',
            timestamp: '{ts}__NUM__',
            method: 'return_home',
            data: null
        }).replace('"{ts}__NUM__"', '{ts}'),
        qos: 1,
        params: [
            { key: 'gateway', label: '机场 SN', required: true, placeholder: '例如 5YSZK8Q00200T9' },
            uuidParam('tid', uuid),
            uuidParam('bid', uuid),
            timestampParam(now)
        ]
    };
}

function createDrcSender({ id, name, method, group = '遥控指令' }) {
    const now = Date.now();
    return {
        id,
        name,
        group,
        topic: 'thing/product/{airportSn}/drc/down',
        payloadTemplate: JSON.stringify({
            method,
            data: {},
            seq: '{seq}__NUM__'
        }).replace('"{seq}__NUM__"', '{seq}'),
        qos: 1,
        params: [
            { key: 'airportSn', label: '机场 SN', required: true, placeholder: '例如 8UUXNCJ00A0XWG' },
            { key: 'seq', label: 'seq', type: 'number', default: now }
        ]
    };
}

module.exports = {
    activate(ctx) {
        ctx.log('DJI 上云插件已激活');
    },

    senders: () => ([
        createServiceSender({ id: 'control.drone.power_on', name: '飞行器开机', method: 'drone_open' }),
        createServiceSender({ id: 'control.dock.reboot', name: '机场重启', method: 'device_reboot' }),
        createServiceSender({ id: 'control.drone.power_off', name: '飞行器关机', method: 'drone_close' }),
        createServiceSender({ id: 'control.cover.open', name: '打开舱盖', method: 'cover_open' }),
        createServiceSender({ id: 'control.cover.close', name: '关闭舱盖', method: 'cover_close' }),
        createReturnHomeSender(),
        createDrcSender({ id: 'drc.emergency_stop', name: '急停', method: 'drone_emergency_stop' }),
        createDrcSender({ id: 'drc.emergency_landing', name: '紧急降落', method: 'drc_emergency_landing' }),
        createDrcSender({ id: 'drc.force_landing', name: '强制降落', method: 'drc_force_landing' }),
        createDebugSender('debug.mode.open', '开启 Debug 模式', 'debug_mode_open'),
        createDebugSender('debug.mode.close', '关闭 Debug 模式', 'debug_mode_close')
    ]),

    senderParamAction(request) {
        if (request.actionId === 'randomUuid') return randomUuid();
        if (request.actionId === 'currentTimestamp') return Date.now();
        throw new Error(`未知参数动作：${request.actionId}`);
    },

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
                },
                rememberParams: {
                    sn,
                    airportSn: sn,
                    gateway: sn
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
        highlights.push(...extractDataHighlights(body.data, sn));
        if (body.data && Object.prototype.hasOwnProperty.call(body.data, 'mode_code')) {
            const expectedLabel = fieldLabelForDevice('mode_code', sn);
            for (let i = highlights.length - 1, seen = false; i >= 0; i -= 1) {
                if (highlights[i].label !== expectedLabel) continue;
                if (seen) highlights.splice(i, 1);
                seen = true;
            }
        }
        const fieldValues = collectFieldValues(body.data, '$.data', [], new Set(), sn);

        const rememberParams = {};
        if (sn) rememberParams.sn = sn;
        if (meta.airportSn) rememberParams.airportSn = meta.airportSn;
        if (meta.droneSn) rememberParams.droneSn = meta.droneSn;
        if (meta.gatewaySn) rememberParams.gateway = meta.gatewaySn;

        return {
            summary: `${parts.join(' | ')} | ${sn}`,
            highlights,
            fieldValues,
            fieldLabels: fieldValues.map(({ path, key, label }) => ({ path, key, label })),
            topicLabel: `${icon} ${suffixLabel}`,
            rememberParams,
            tree: body,
            meta
        };
    }
};
