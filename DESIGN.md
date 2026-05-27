# Noir Stage — 暗夜舞台设计系统

> 艺人管理系统 v3.0 的设计语言。暗色底 + 单色金主调，服务于演出场所/酒吧的艺人管理场景。气质上追求「低调专业、沉稳中带一点舞台感」，避免花哨。

---

## 1. 视觉氛围

**关键词**：暗夜、舞台聚光、克制、专业工具感

- 深色为底，金色作为唯一强调色，不做多色拼接
- 不追求炫技式的渐变或玻璃拟态，保持工具型应用的沉静感
- 全局覆盖一层极淡的噪点纹理（opacity 4%），模拟舞台幕布质感
- 卡片和面板用微弱的边框区分层级，不用大面积阴影

**情绪板参考**：Linear 的功能性暗色 + Spotify 的暗底单色逻辑 + 演出场馆的低调灯光氛围

---

## 2. 色彩系统

### 2.1 品牌色

| Token | 色值 | 用途 |
|-------|------|------|
| Primary | `#D4A853` | 主按钮、激活态、强调文字、标题装饰线 |
| Primary Hover | `#C49A3C` | 按钮悬停 |
| Primary Glow | `rgba(212,168,83,0.25)` | 光影、按钮阴影、激活态光环 |
| Secondary | `#B8956A` | 次要元素、渐变辅助色 |

### 2.2 功能色

| Token | 色值 | 用途 |
|-------|------|------|
| Success | `#5B8C5A` | 正面评价、成功状态 |
| Warning | `#D4A853` | 警告（复用 Primary） |
| Danger | `#B85151` | 删除、错误、注销 |
| Info | `#6A9FB5` | 中性信息提示 |

### 2.3 中性色（表面层级）

| Token | 色值 | 用途 |
|-------|------|------|
| Body BG | `#121214` | 页面底色，最深 |
| Surface BG | `#1C1C21` | 一级容器（内容区、头部、导航、弹窗） |
| Surface Raised | `#24242A` | 二级容器（卡片、图表容器、表格容器） |

### 2.4 中性色（文字）

| Token | 色值 | 用途 |
|-------|------|------|
| Text | `#E4DFD6` | 正文、标题（暖白，不是纯白） |
| Text Muted | `#8A857A` | 辅助说明、次级信息 |
| Text Dim | `#5C5850` | 占位符、页脚、禁用态 |

### 2.5 中性色（边框）

| Token | 色值 | 用途 |
|-------|------|------|
| Border | `#2E2E36` | 默认边框 |
| Border Light | `#383840` | Hover 态边框、移动端卡片边框 |

### 2.6 语义色使用规则

```
正面/成功: 背景 rgba(91,140,90,0.2) + 文字 #7BC47D
负面/危险: 背景 rgba(184,81,81,0.2) + 文字 #E07373
金色徽章: 金色底色 + 黑色文字 #121214
```

**禁止**：
- 不要用纯白 `#FFFFFF` 或纯黑 `#000000`
- 不要在 Noir 主题下使用高饱和度的蓝/紫/绿
- 不要给卡片加 >2px 的彩色边框

---

## 3. 字体系统

### 3.1 字体族

```css
font-family: -apple-system, BlinkMacSystemFont, "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif;
```

优先系统字体，中文回退到 Noto Sans SC → PingFang SC → 微软雅黑。

### 3.2 字号层级

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| H1 | 28px | 700 | 页面主标题 |
| H2 / Section Title | 20px | 700 | 区块标题 |
| H3 / Chart Title | 15px | 600 | 图表标题 |
| Card Value | 32px | 800 | 统计卡片数值 |
| Body | 14px | 400 | 正文、表格、表单 |
| Small | 13px | 500 | 卡片标题、标签 |
| Caption | 12px | 600 | 表格表头、徽章、状态文字 |
| Tiny | 11px | 600 | 设置标签、移动端辅助文字 |

### 3.3 字距

- 标题：`letter-spacing: 0.02em`
- 大写标签：`letter-spacing: 0.05em ~ 0.08em`
- 数值：`letter-spacing: -0.02em`（紧凑）

**注意**：移动端字号不做缩小，表单输入框必须 ≥16px 防止 iOS 缩放。

---

## 4. 间距系统

### 4.1 基础栅格

以 4px 为原子单位，常用间距：

| 名称 | 值 | 用途 |
|------|-----|------|
| xs | 4px | 导航按钮间距、图标与文字间距 |
| sm | 8px | 表单项内间距、徽章内边距 |
| md | 12px | 表格单元格、小卡片内边距 |
| lg | 16px | 卡片间距、图表间距 |
| xl | 20px | 区块头部间距、表格容器内边距 |
| 2xl | 24px | 区块标题下方间距、容器外边距 |
| 3xl | 28px | 内容区 padding、弹窗 padding |
| 4xl | 32px | 页脚上边距 |

### 4.2 容器

- App 容器最大宽度：`1440px`，水平居中
- 桌面端 padding：`24px`
- 移动端 padding：`8px 12px`（底部加 safe-area + 导航高度）

---

## 5. 圆角系统

| 层级 | 值 | 适用组件 |
|------|-----|----------|
| 大圆角 | 16px | 头部、内容区、弹窗 |
| 中圆角 | 14px | 导航容器、统计卡片、图表容器、表格容器、设置菜单 |
| 标准圆角 | 10px | 按钮、输入框、导航按钮 |
| 小圆角 | 8px | 小按钮、表格滚动区、移动端徽章 |
| 胶囊 | 20px | 徽章 |
| 圆形 | 50% | 头像、设置齿轮按钮、关闭按钮 |

**规则**：同一视觉层级的组件用同样的圆角，不要混搭。

---

## 6. 组件规范

### 6.1 按钮

```
主按钮: background primary-color, color #121214, border-radius 10px
  hover: background primary-hover + box-shadow 0 4px 16px primary-glow
  内边距: 10px 22px, 字重 600

次要按钮: background surface-raised, border 1px border-color
  hover: background nav-hover-bg

小按钮 (.btn-sm): padding 6px 14px, font 12px, border-radius 8px
移动端全宽按钮: min-height 46px, border-radius 12px
```

**规则**：
- 主按钮文字必须用 `#121214`（深底反白不可读时会糊）
- 按钮必须有 hover 态反馈，不能只有颜色变化
- 移动端触控目标 ≥44px

### 6.2 输入框

```
默认: background body-bg, border 1px border-color, border-radius 10px
  padding: 10px 14px, font 14px
focus: border-color primary-color + box-shadow 0 0 0 3px primary-glow (ring)
placeholder: text-dim 色
```

- 所有输入框聚焦态统一用金色 ring，3px 宽度
- 搜索框左侧有图标占位（padding-left: 38px）

### 6.3 卡片

```
统计卡片 (.stat-card):
  background surface-raised, border-radius 14px
  padding 22px 24px, border 1px border-color
  hover: translateY(-3px) + border-color 变亮 + card-glow 渐显
  ::after 伪元素承载 hover 时的 box-shadow（避免布局抖动）

图表容器 (.chart-container): padding 22px, 其余同上
表格容器 (.table-container): padding 20px, 其余同上
```

**规则**：
- 卡片和容器在 Noir 主题下用 `border` 区分层级，不用阴影
- Hover 动效要克制：位移不超过 3px，过渡 0.3s ease

### 6.4 表格

```
表头: background #2A2A32, color #D4A853, font 12px uppercase, 字距 0.05em
  底部 2px solid border-light
数据行: padding 10px 14px, font 14px
  斑马纹: table-row-alt (极淡金色)
  hover: table-hover (稍强的金色)
```

- 表头固定（sticky），最长 420px 高的滚动区
- 移动端表格最小宽度 600px，允许横向滚动

### 6.5 弹窗

```
遮罩: modal-overlay (70% 不透明度纯黑)
内容: background surface-bg, border-radius 16px, padding 28px
  max-width 620px, 宽度 50%
  动画: modalSlideIn (0.3s, 从上方 24px 滑入 + scale 0.97→1)
移动端: width 94vw, max-width 94vw, border-radius 18px, max-height 92vh 可滚动
```

关闭按钮：36px 圆形，hover 时背景变红（`rgba(184,81,81,0.1)`）+ 图标变 danger 色

### 6.6 Toast

```
固定右上角, z-index 1050
background surface-raised, border-radius 12px, padding 14px 20px
左边 4px 彩色条: success=绿, error=红, info=蓝
动画: slideIn 0.35s (从右侧滑入)
移动端: 全宽, 顶部居中
```

### 6.7 导航

**桌面端**：水平 pill 式导航容器
- 容器: surface-bg, border-radius 14px, padding 6px, 按钮间距 4px
- 按钮: 透明底, border-radius 10px, padding 10px 20px
- Hover: nav-hover-bg 背景 + primary-color 文字
- Active: primary-color 背景 + `#121214` 文字 + 金色光晕阴影

**移动端**：底部固定导航栏，毛玻璃效果
- 高度 64px + safe-area
- 背景: `rgba(28,28,33,0.92)` + `backdrop-filter: blur(20px) saturate(180%)`
- 图标+文字纵向排列，4-5 个等分按钮
- Active: primary-color 纯色文字（无背景），图标 scale(1.1)

### 6.8 徽章

```
padding 5px 12px, border-radius 20px, font 12px 600
Primary: primary-color 底 + #121214 字
Success: success-color 底 + #fff 字
Danger: danger-color 底 + #fff 字
Info: info-color 底 + #fff 字
```

### 6.9 头像

```
42x42px 圆形, border 2px solid border-color
hover: border-color 变为 primary-color
```

### 6.10 评价标签

```
正面: rgba(91,140,90,0.2) 背景 + #7BC47D 文字 + rgba(91,140,90,0.3) 边框
负面: rgba(184,81,81,0.2) 背景 + #E07373 文字 + rgba(184,81,81,0.3) 边框
border-radius 14px, padding 4px 12px, font 12px 600
```

---

## 7. 深度与层级

Noir 主题**不依赖阴影区分层级**，而是通过背景色深浅：

```
页面底 (body-bg)       #121214  ← 最深
一级容器 (surface-bg)  #1C1C21
二级容器 (surface-raised) #24242A  ← 最浅
```

阴影仅用于特定场景：
- 弹窗：`0 20px 60px rgba(0,0,0,0.4)`
- Toast：`0 12px 32px rgba(0,0,0,0.3)`
- 设置菜单：`0 16px 48px rgba(0,0,0,0.4)`
- 按钮激活：`0 2px 12px primary-glow`
- 卡片 Hover：`card-glow`（0 0 20px 金色微光）

---

## 8. 动效规范

### 8.1 过渡时间

| 类型 | 时长 | 缓动 | 场景 |
|------|------|------|------|
| 微交互 | 0.15s | ease | 设置菜单项 hover |
| 标准 | 0.25s | ease | 按钮、输入框、导航切换 |
| 慢速 | 0.3s | ease | 卡片 hover、弹窗动画 |
| 主题切换 | 0.4s | ease | 切换配色方案 |

### 8.2 关键帧动画

- `fadeIn`: 透明度 0→1，0.2s（遮罩）
- `fadeInUp`: 透明度 + 上移 16px，0.5s（页面进入）
- `modalSlideIn`: 透明度 + 从上方 24px 滑入 + 缩放 0.97→1，0.3s
- `slideIn`: 从右侧 120% 滑入，0.35s（Toast）
- `pulseGlow`: 按钮呼吸光晕（box-shadow 放大到透明）

### 8.3 卡片交错进场

统计卡片依次延迟 0.05s 进场（nth-child 1→4，延迟 0.05s→0.2s）

---

## 9. 响应式行为

### 9.1 断点

| 断点 | 行为 |
|------|------|
| ≥768px | 桌面端：完整布局、侧边 pill 导航、齿轮设置 |
| ≤767px | 移动端：底部导航、全宽按钮、隐藏桌面导航和设置齿轮 |

### 9.2 移动端规则

- 最大宽度 100%，padding 收窄到 12px
- 统计卡片 2 列布局（`flex: 0 0 50%`）
- 按钮全宽 + `min-height: 46px` + `border-radius: 12px`
- 输入框 `font-size: 16px`（防止 iOS 自动缩放）
- 表格允许横向滚动（`min-width: 600px`），关闭 hover 动效
- 弹窗占 94vw，上边距 3vh
- 禁用默认文本选择（`user-select: none`），输入框除外
- `overscroll-behavior: none` 防止橡皮筋效果
- 所有交互目标 ≥44px

### 9.3 触控适配（无 hover 设备）

```css
@media (hover: none) {
  导航按钮: 取消 hover 效果，改为 active 时触发
  统计卡片: 取消 hover 上浮和阴影
}
```

---

## 10. 设计护栏（不要做的事）

1. ❌ 不要在 Noir 主题下用纯白文字 — 始终用 `#E4DFD6`
2. ❌ 不要给卡片加粗边框或彩色边框 — 用 `#2E2E36` 1px
3. ❌ 不要在 Noir 主题下引入高饱和度的蓝/紫/绿强调色
4. ❌ 不要用 box-shadow 作为卡片层级区分 — 用背景色深浅
5. ❌ 不要直接覆盖 `--primary-color` 变量的使用场景
6. ❌ 移动端按钮不能小于 44px
7. ❌ 不要使用超过 2 个字重的字体组合（700 + 400 足够）
8. ❌ 不要在非 hover 设备上保留 hover 动效
9. ❌ 不要用 `filter: brightness()` 做 hover 效果（已用专用变量）
10. ❌ Noir 主题下不要关闭或覆盖噪点纹理（`body::after`）

---

## 11. 给 AI Agent 的 Prompt 模板

```
你在 Noir Stage 设计系统中工作。规则：

- 主色 #D4A853（金），强调用暖白 #E4DFD6，绝不用纯白
- 三层表面: #121214(底) → #1C1C21(容器) → #24242A(卡片)
- 圆角: 16px(大容器) / 14px(卡片) / 10px(按钮输入框)
- 间距以 4px 为单位，常用 12/16/20/24/28
- 动效 0.25s ease 为主，不超 0.3s
- 卡片和容器用 border 区分层级，不用投影
- 移动端: 触控目标 ≥44px, 输入框 16px, 按钮全宽
- 字体: system stack + Noto Sans SC 中文优先
- 设计气质: 暗夜 + 舞台感，克制，不花哨
```

---

## 辅助主题

系统还包含两个旧版主题（通过 `data-theme` 属性切换）：

| 主题 | data-theme | 主色 | 风格 |
|------|-----------|------|------|
| Noir Stage | `noir` | `#D4A853` 金 | 暗夜舞台（默认） |
| Morandi | `morandi` | `#7B8FA1` 灰蓝 | 莫兰迪浅色 |
| Orange | `orange` | `#FF6B35` 橙 | 暖橙浅色 |

新功能开发只需遵循 Noir Stage 规范。Morandi 和 Orange 为兼容保留，不做进一步扩展。
