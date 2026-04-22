# MQTTMountain 插件 · 大疆上云 API（Dock 3）

[MQTTMountain](https://github.com/finalpi/MQTTMountain) 的第三方插件。针对 [大疆上云 API Thing 协议](https://developer.dji.com/doc/cloud-api-tutorial/cn/)（主要覆盖 Dock 3 机场），提供：

- 📊 **消息解析**：自动识别 `thing/product/{sn}/...` 主题，解析 method / tid / bid / gateway / timestamp 等通用字段
- 🏷️ **主题别名**：把 `thing/product/.../state` 翻译成「📊 状态上报」等中文标签
- 📝 **Dock 3 字段翻译**：job_number → 作业次数、working_voltage → 工作电压（mV）等 40+ 字段中文名
- 💬 **发送模板**：一键下发常见调试与控制指令（开关飞机、开关舱盖、重启、格式化、直播推流等）

## 安装

打开 MQTTMountain →「🧩 插件」Tab → 填入本仓库 URL →「📥 从 Git 安装」→ 启用。

```
https://github.com/finalpi/MQTTMountain-Shangyun-Plugin.git
```

也可以直接把仓库目录复制到 `%APPDATA%/MQTTMountain/plugins/com.finalpi.dji-shangyun/`，然后在插件面板点 🔄 刷新。

## 识别的主题模式

| 主题 | 含义 |
|---|---|
| `thing/product/{sn}/state` | 状态上报 |
| `thing/product/{sn}/state_reply` | 状态应答 |
| `thing/product/{sn}/osd` | OSD 实时推送 |
| `thing/product/{sn}/events` | 事件上报 |
| `thing/product/{sn}/services` | 下行指令 |
| `thing/product/{sn}/services_reply` | 指令应答 |
| `thing/product/{sn}/requests` | 上行请求 |
| `thing/product/{sn}/properties` | 属性设置 |
| `sys/product/{sn}/status` | 设备上下线 |

（详见 manifest 的 `topicPatterns`）

## 发送模板清单

**机场调试**
- 🛩️ 开启/关闭飞机
- 📤 舱盖打开 / 📥 舱盖关闭
- ⬆️ 推杆展开 / ⬇️ 推杆收回
- 🔌 充电开启 / 🔋 充电关闭

**机场控制**
- 🔄 机场重启 / 🔁 飞机重启
- 🗑️ 机场格式化 / 🗑️ 飞机格式化

**直播**
- 📹 开始直播推流 / ⏹️ 停止直播推流

所有模板都需要填入：
- `sn`：机场 SN，例 `8UUXNCJ00A0XWG`
- `tid` / `bid`：会自动生成 UUID（你也可以覆盖）
- `timestamp`：自动填当前毫秒（你也可以覆盖）

## 解码结果示例

订阅 `thing/product/{sn}/state` 收到下面这种消息时：

```json
{
    "gateway": "8UUXNCJ00A0XWG",
    "tid": "50e63b7f-...",
    "bid": "d43b9020-...",
    "timestamp": 1776829912696,
    "method": "state",
    "data": {
        "job_number": 1030,
        "acc_time": 6048013,
        "working_voltage": 47964,
        "electric_supply_voltage": 224,
        "drone_in_dock": 1
    }
}
```

在消息上**右键**弹出格式化查看器，顶部会显示紫色信息条：

```
🧩 📊 状态上报 · state · 8UUXNCJ00A0XWG
   SN: 8UUXNCJ00A0XWG   method: state   timestamp: 2026-04-22T03:51:54.038Z
   作业次数: 1030   工作电压（mV）: 47964   交流供电电压（V）: 224   飞机在舱: 1
```

## 开发

克隆后直接改 `index.js`（纯 Node CommonJS）→ 在 MQTTMountain 的「🧩 插件」面板点「🔄 重载」热更新，无需重启宿主。

`senders`、`decode`、`topicLabel` 三个扩展点的 API 详见宿主仓库 `docs/PLUGIN.md`。

## License

MIT
