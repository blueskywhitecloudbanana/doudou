# 痘痘记录（doudou-tracker）

在 3D 中性人体模型上记录长痘位置，支持按年/月筛选、区域统计与历史回顾，可选 Supabase 云同步实现手机 / iPad 多设备使用。照片功能暂未包含（规划中以端到端加密方式实现）。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端显示的地址（默认 http://localhost:5173）。`vite.config.ts` 已开启 `host: true`，同一 Wi-Fi 下手机/iPad 可通过电脑局域网 IP 访问。

## 使用方法

- **身体**页：拖拽旋转、双指缩放模型；点「＋ 标记」进入标记模式，点击身体表面任意位置即可记录（区域自动判定，可在表单中修改）。点击已有标记点查看/编辑/删除，或填写消退日期。顶部可按年/月筛选显示。
- **统计**页：每月新增柱状图、区域分布排行；点击某区域查看该位置全部历史（含持续天数与平均复发间隔）。
- **设置**页：配置云同步、导出/导入 JSON 备份。

## 云同步（可选）

1. 在 [supabase.com](https://supabase.com) 免费创建一个项目
2. 在项目的 SQL Editor 中执行「设置」页里展示的建表 SQL（一次即可）
3. 把项目的 URL 与 anon key 填入「设置」页，注册并登录
4. 每台设备登录同一账号，点「立即同步」即可双向合并

数据始终在本地保留一份（localStorage），云端仅存于你自己的 Supabase 项目，行级安全策略保证只有本人账号可读写。

## 部署（多设备随时访问）

构建后是纯静态站点，推荐部署到 Vercel / Netlify / Cloudflare Pages：

```bash
npm run build   # 产物在 dist/
```

部署后用手机/iPad 浏览器打开网址，可「添加到主屏幕」作为 PWA 使用。

## 技术栈

React + TypeScript + Vite · Three.js（@react-three/fiber + drei）· Zustand · Supabase

## 人体模型

写实人体来自 [Blender Studio Human Base Meshes](https://download.blender.org/demo/asset-bundles/human-base-meshes/)（CC0 协议），含男/女两种体型（应用内右上角切换）。导出管线见 [scripts/export_bodies.py](scripts/export_bodies.py)：按 UV 岛把网格分类为 7 个身体部位（头/躯干/骨盆/左右臂/左右腿），烘焙进顶点色 R 通道（id/7），应用一级多级细分后导出 glb。应用内点击模型表面时，从命中三角形的顶点色解码部位，再结合归一化身高与前后侧得到精确区域（面部/颈前后/胸/腹/后背上下/臀/四肢）。重新导出：

```powershell
blender -b human_base_meshes_bundle.blend -P scripts/export_bodies.py -- public/models
```

## 数据模型

每条记录包含：长痘/消退日期、严重程度（1–5）、备注、命中的身体部件、自动判定的区域名（统计维度）、模型表面坐标与法线（3D 标记点渲染）、`updatedAt` 与软删除墓碑（用于多端同步合并，新者胜）。
