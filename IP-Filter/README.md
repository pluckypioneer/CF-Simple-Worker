# 🌍 Cloudflare 优选节点国家/地区筛选器 (增强版)

这是一个基于 Cloudflare Workers 的轻量级工具，用于实时从全球 Cloudflare 优选节点池中提取、筛选指定国家/地区的 IP，并生成适用于代理订阅平台的 `CFnew` 或 `edgetunnel` 订阅链接。

💡 **特别声明与致谢：**
本项目是从 [alienwaregf/Cloudflare-Country-Specific-IP-Filter](https://github.com/alienwaregf/Cloudflare-Country-Specific-IP-Filter) 的开源代码改进而来。在此对原作者的优秀框架，以及数据源提供者（CM 大佬、Joey 大佬）表示最诚挚的感谢！

基于 Cloudflare Worker 的全球 IP 节点筛选工具，支持按国家/地区和 ASN 过滤，提供 CFnew / Edgetunnel 订阅格式输出。

数据源来自 `https://zip.cm.edu.kg/all.json`，Worker 部署后即可使用。

## 功能

- **多地区筛选** — 可视化选择多个国家/地区，支持全选、随机抽选
- **ASN 搜索** — 右上角搜索框输入 ASN 编号，快速定位该网络下的所有节点
- **两种输出格式** — CFnew (`ip:port#序号 国旗 名称`) 和 Edgetunnel (`ip:port#国旗 名称`)
- **订阅链接生成** — 一键复制 `/CFnew/US-JP` 或 `/edgetunnel/US,JP` 格式的订阅地址
- **暗色模式** — 支持浅色/深色/跟随系统
- **CORS 全开** — 所有接口均可跨域调用

## API

| 路径 / 参数 | 说明 |
|---|---|
| `GET /` | Web UI 主页 |
| `GET ?get_regions=1` | 返回所有地区统计 (JSON) |
| `GET ?api=1&region=US,JP&format=cf_line_short&limit=10` | 按地区提取节点 |
| `GET ?asn=13335` | 按 ASN 搜索节点 (JSON) |
| `GET /CFnew/US-JP?limit=10` | CFnew 格式订阅 (路径模式) |
| `GET /edgetunnel/US,JP?limit=10` | Edgetunnel 格式订阅 (路径模式) |
| `GET /CFnew/US-JP?base64=1` | Base64 编码输出 |

### ASN 搜索返回格式

```json
{
  "asn": 13335,
  "total": 3,
  "items": [
    {
      "ipPort": "1.1.1.1:443",
      "hostname": "one.one.one.one",
      "country": "US",
      "countryCn": "美国",
      "countryEmoji": "🇺🇸",
      "city": "Los Angeles",
      "colo": "LAX",
      "asn": 13335,
      "asnOrg": "Cloudflare, Inc."
    }
  ]
}
```
## 参数说明

| 参数 | 说明 | 默认值 |
|---|---|---|
| `region` | 国家代码，逗号或短横线分隔 | 无 (必填) |
| `format` | 输出格式 | `line` |
| `limit` | 单地区最大提取数量 (0=不限) | `0` |
| `base64` | 设为 `1` 启用 Base64 编码 | 关闭 |

### format 可选值

| 值 | 格式示例 |
|---|---|
| `line` | `ip:port#🇺🇸 美国` |
| `cf_line_short` | `ip:port#🇺🇸 美国¹` |
| `cf_comma_short` | 同上，逗号分隔 |
| `comma` | 同 line，逗号分隔 |


## 🚀 部署指南

本项目完全依赖 Cloudflare Workers 运行，零成本、免服务器。

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 在左侧菜单找到 **Workers & Pages** -> 点击 **Create application** -> **Create Worker**。
3. 为你的 Worker 起个名字，点击 **Deploy**。
4. 进入刚刚创建的 Worker，点击右上角的 **Edit code**。
5. 清空左侧编辑器里的默认代码，将本项目修改后的完整代码粘贴进去，点击右上角的 **Deploy** 保存即可部署。

