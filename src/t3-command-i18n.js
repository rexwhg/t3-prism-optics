(function (root) {
  'use strict';
  const G = root || (typeof globalThis !== 'undefined' ? globalThis : window);
  if (!G) return;

  // Curated Chinese descriptions for T3 Code / Antigravity / Codex / Claude slash commands & skills.
  // Original English invocation tokens (/goal, /schedule, /agy-customizations, etc.) stay untouched on the left,
  // and key English technical terms are retained naturally inside the Chinese descriptions.
  const COMMAND_ZH_MAP = Object.freeze({
    // Built-in T3 Code & core agent slash commands
    model: '切换当前会话使用的回复模型（model）',
    side: '在新侧边对话中提出旁支问题（side chat）',
    btw: '同 /side，在旁支对话中提问',
    clear: '开启全新上下文会话，保留历史消息可见（clear）',
    compact: '立即压缩对话上下文，总结历史以释放窗口空间（compact）',
    goal: '持续执行任务，直到指定目标彻底完成（goal）',
    schedule: '按周期定时或一次性定时器执行指令（schedule）',
    browser: '调用浏览器 Agent 执行网页浏览与交互任务（browser）',
    plan: '执行任务前先进行严谨的分步规划（plan）',
    'grill-me': '通过交互式追问访谈来对齐方案与细节（grill-me）',
    teamwork: '调用多 Agent 团队自主协作攻克大型项目（teamwork）',
    learn: '复盘近期成功经验或纠错，沉淀可复用的 Skill 或规则（learn）',
    boost: '调用 Boost 多 Agent 编排器处理复杂研发与研究任务（boost）',
    feedback: '向 OpenAI 发送当前会话与 Codex 日志反馈（feedback）',
    'usage-limits': '查看当前 Provider 的用量限额与配额（usage-limits）',

    // Common Codex / Claude Code / CLI slash commands
    status: '查看当前会话、模型与工作区状态（status）',
    review: '对代码改动执行缺陷优先的只读审查（review）',
    init: '初始化项目配置或生成 AGENTS.md / CLAUDE.md 指南（init）',
    diff: '查看当前工作区的 Git 变更差异（diff）',
    mcp: '查看与管理已连接的 MCP 服务器及工具（mcp）',
    agents: '查看与管理自定义 Subagent 子智能体（agents）',
    permissions: '查看或修改工具执行与访问权限规则（permissions）',
    memory: '查看或编辑持久化记忆与项目上下文（memory）',
    doctor: '诊断运行环境、依赖与配置健康状态（doctor）',
    cost: '查看当前会话的 Token 消耗与费用统计（cost）',
    context: '检查当前上下文窗口占用明细（context）',
    resume: '恢复历史会话并继续之前的工作（resume）',
    rewind: '回退对话与代码更改到之前的检查点（rewind）',
    rename: '重命名当前会话标题（rename）',
    copy: '复制最新回复或会话内容到剪贴板（copy）',
    export: '将当前会话导出为本地 Markdown 文件（export）',
    help: '查看可用命令与使用帮助（help）',
    bug: '提交问题反馈与错误报告（bug）',
    fast: '切换快速响应模式（fast）',
    effort: '调整模型推理深度（Effort）挡位',
    vim: '切换输入框 Vim 键位模式',
    hooks: '管理自动化 Hook 钩子配置（hooks）',
    'reload-plugins': '重新加载本地插件与扩展（reload-plugins）',
    skills: '浏览与管理已安装的 Agent Skills（skills）',
    'pr-comments': '读取并处理 Pull Request（PR）评审评论',
    'release-notes': '查看当前版本更新日志（Release Notes）',
    'security-review': '对当前分支改动执行安全代码审查（security-review）',
    insights: '分析历史会话并生成使用洞察报告（insights）',
    theme: '切换界面配色与外观主题（theme）',
    config: '查看或修改偏好设置与配置项（config）',
    login: '登录当前 Provider 账号（login）',
    logout: '退出当前 Provider 登录（logout）',
    usage: '查看当前账号用量统计（usage）',
    'extra-usage': '管理额外用量额度（Extra Usage）',
    sandbox: '查看或调整命令沙箱隔离模式（sandbox）',
    fork: '从当前上下文分叉创建新会话（fork）',
    branch: '切换或管理 Git 分支（branch）',
    new: '新建空白会话（new）',
    quit: '退出当前会话（quit）',
    exit: '退出当前会话（exit）',
    approvals: '配置命令与文件修改的审批策略（approvals）',
    mentions: '查看 @ 引用文件、会话与环境的用法（mentions）',
    undo: '撤销上一步代码变更（undo）',
    ps: '查看当前后台运行中的进程与任务（ps）',
    debug: '排查会话异常与调试运行日志（debug）',
    voice: '开启或配置语音输入模式（voice）',
    worktree: '在独立 Git Worktree 中隔离开发（worktree）',

    // Antigravity built-in skills & workflows
    'agy-customizations': 'Antigravity 自定义系统完整指南：加载优先级、发现机制及 Skill / Rule / Plugin / Hook / MCP 编写参考',
    'antigravity-guide': 'Google Antigravity (AGY) 综合手册：涵盖 agy CLI、Antigravity 2.0、IDE、Python SDK 与斜杠命令',
    antigravity_guide: 'Google Antigravity (AGY) 综合手册：涵盖 agy CLI、Antigravity 2.0、IDE、Python SDK 与斜杠命令',
    automation: '交互式设计并创建后台定时或周期自动化任务（Automation）',
    conversations: '通过 HTTP+JSON 编程管理本地 Antigravity 会话（新建、列表、重命名、归档、置顶、删除等）',
    generative_ui: '在对话中内嵌或以独立 Artifact 渲染交互式 HTML 图表与可视化组件（Generative UI）',
    'generative-ui': '在对话中内嵌或以独立 Artifact 渲染交互式 HTML 图表与可视化组件（Generative UI）',
    'mcp-app-development': '构建、打包与调试 Antigravity MCP Apps（可在对话或侧栏渲染交互式 UI 的 MCP 工具）',
    'migrate-agent-settings': '将 Claude Code / Codex / Cursor / Gemini CLI 的 MCP、Skill、命令与规则迁移到 Antigravity',
    'migrate-workflows': '将旧版 Workflows 自动迁移为新版 Agent Skills（生成 SKILL.md 并归档旧文件）',
    'permissioned-github': 'GitHub 权限化操作指南：环境受限时向用户申请授权后再执行',
    plugin: '管理与创建 Plugin 插件包（统一打包与启停 Skills、Agents、Rules、MCP 与 Hooks）',
    'run-workflow': '使用 run_workflow 编写并运行 Python 动态多 Agent 编排脚本（agent / parallel / pipeline / phase）',
    swarm: '（预览·高配额消耗）启动多 Agent Swarm 协作群组，通过共享消息板并行攻关同一任务',
    swarm_monitor: '仅限 Swarm 监控成员（Monitor）使用：定时检测群组停滞并唤醒对应成员推进',
    swarm_narrator: '仅限 Swarm 播报成员（Narrator）使用：监听消息板并同步更新 Overview 概览视图',
    swarm_pane: '仅限 Swarm 协调者（Coordinator）使用：维护 Swarm 面板的目标、任务分组与截图时间线',
    'ui-plugin-navigation': '发现与当前任务相关的 UI 插件面板，并在对话中提供一键打开/切换胶囊按钮',

    // Local & Codex / Claude / Cursor Agent Skills
    babysit: '持续看护 PR 至可合并状态：循环处理评审评论、解决冲突并修复 CI 失败',
    clipcat: '通过 clipcat CLI 制作 TikTok 电商视频：达人/商品洞察、爆款复刻、商品生视频与抖音/TikTok 下载',
    'create-hook': '创建 Codex Hook 钩子：编写 hooks.json 与脚本，在 Agent 事件前后自动触发逻辑',
    'create-rule': '创建 Codex 持久化指导规则：配置编码规范、项目约定、文件匹配规则或 RULE.md / AGENTS.md',
    'create-skill': '指导编写高效的 Codex Agent Skills（涵盖目录结构、最佳实践与 SKILL.md 规范）',
    'create-statusline': '为 Codex CLI 构建并启用自定义 MCP 状态栏（显示在终端底部）',
    'create-subagent': '创建专职自定义 Subagent 子智能体（代码审查员、调试专家或特定领域助手）',
    'cua-driver': '通过 cua-driver CLI 或 MCP 驱动本机桌面 GUI 应用（macOS/Windows/Linux 无障碍树快照与键鼠操作）',
    'migrate-to-skills': '将旧版规则（.mdc）与斜杠命令（commands/*.md）迁移为 Agent Skills（SKILL.md）格式',
    shell: '将 /shell 后的内容作为字面量 Shell 命令直接在终端中执行',
    statusline: '配置 CLI 自定义底部状态栏（statusLine），在提示符下方展示会话上下文信息',
    'update-cli-config': '查看并修改 ~/.cursor/cli-config.json 中的 Codex CLI 配置（权限、审批模式、Vim、沙箱等）',
    'update-cursor-settings': '修改 Codex/VSCode 的 settings.json 编辑器偏好（主题、字号、缩进、保存格式化、快捷键等）',
    anysearch: '实时搜索引擎：支持全网搜索、垂直领域检索、并行批量搜索与网页正文提取',
    'context-handoff': '将当前 Codex 会话压缩为精简结构化交接摘要，便于切换模型或新会话无缝续跑',
    'export-session': '将当前或指定的 Codex 会话导出为本地 Markdown 文件',
    'hatch-pet': '从角色设定或参考图制作、修复、视觉验收并打包 Codex v2 动画桌宠',
    imagegen: '为网站、游戏、插画、精灵图与透明抠图生成或编辑 AI 图像（imagegen）',
    'no-ai-slop-writing-system': '检测与润色文本、去除“AI 味”空话套话，让表达具体、扎实、自然',
    noyap: '精简啰嗦过程说明，强制输出极简且准确的代码实现（减少废话）',
    'openai-docs': 'OpenAI API 新手入门及 Codex / ChatGPT Work 官方文档问答',
    'review-agent': '对指定代码改动执行只读、缺陷优先审查，找出所有可落地修复的缺陷',
    'skill-creator': '创建或更新 Codex Skill 及其配套脚本与资源',
    'skill-installer': '从 openai/skills 精选列表或 GitHub 仓库安装技能到 $CODEX_HOME/skills',

    // Productivity / Workspace / OpenAI App Skills
    excel: '创建与编辑电子表格 / Excel 文件',
    powerpoint: '创建与编辑演示文稿 / PowerPoint 幻灯片',
    'browser:control-in-app-browser': '打开并控制应用内浏览器（主要用于本地开发页面与文件）：导航、检查、点击、输入与截图',
    'chrome:control-chrome': '控制用户本机 Chrome 浏览器（复用现有标签页、登录态与扩展）',
    'computer-use:computer-use': '通过 Computer Use 读取并操作本机 Mac 桌面应用界面',
    'documents:documents': '创建与编辑 Word 与 Google Docs 文档',
    'google-drive:google-docs': '读取、编辑与创建 Google Docs 文档',
    'google-drive:google-drive': 'Google Drive / Docs / Sheets / Slides 统一操作入口',
    'google-drive:google-drive-comments': '撰写、回复与解决 Google Drive 批注评论',
    'google-drive:google-sheets': '查找 Google Sheets 表格、查看单元格区域并规划批量更新',
    'google-drive:google-slides': '创建、适配、检查与编辑 Google Slides 演示文稿',
    'pages:maintain-space': '随新工作推进持续维护并更新当前 Pages 页面内容',
    'pages:manage-schedules': '创建、更新或移除 Pages 定时计划',
    'pages:organize-space': '归类整理 Pages 并精简 Space 空间结构',
    'pages:write-page': '使用原生页面工具创建和编辑 Page 内容',
    'papercraft-poster:papercraft-poster': '基于科研论文 PDF 生成有据可依的学术海报（Poster）',
    'pdf:pdf': '读取、创建、渲染并校验 PDF 文件',
    'plugin-management:plugin-management': '发现与推荐插件、检查应用权限和依赖，并管理插件连接或移除',
    'presentations:presentations': '制作精美的 PowerPoint 与 Google Slides 演示文稿',
    'sites:sites': '用 Sites 构建独立网站（落地页、作品集、仪表盘、门户、追踪器、小游戏或工具页）',
    'sites:sites-remix': '基于已有的 Sites 站点二次创作（Remix）生成新网站',
    'spreadsheets:spreadsheets': '创建与编辑电子表格或兼容 Google Sheets 的表格文件',
    'spreadsheets:excel-live-control': '实时操控本机已打开的 Microsoft Excel 桌面工作簿',
    'template-creator:template-creator': '创建或更新基于参考样本的个人专属模板',
    'visualize:visualize': '将想法与数据转化为交互式可视化图表',
    'work-pets:create-pet': '创建并预览新的 ChatGPT Work 模式桌宠',
    'work-pets:pets': '查看、选择并管理 ChatGPT Work 模式桌宠',
    'work-pets:update-pet': '查看或更新自定义 ChatGPT Work 模式桌宠',
  });

  const TEMPLATE_NAME_ZH = Object.freeze({
    'Analytics Dashboard': '数据分析看板（Analytics Dashboard）',
    'Business Review': '业务复盘（Business Review）',
    'Design Report': '设计报告（Design Report）',
    'Experiment Analysis': '实验分析（Experiment Analysis）',
    'Financial Budget': '财务预算（Financial Budget）',
    'Investment Committee Memo': '投委会备忘录（Investment Committee Memo）',
    'Legal Memorandum': '法律备忘录（Legal Memorandum）',
    'Market Trends Report': '市场趋势报告（Market Trends Report）',
    'Minimal Letterhead': '极简信笺（Minimal Letterhead）',
    'Operating Calendar': '运营日历（Operating Calendar）',
    'Operating Review': '经营复盘（Operating Review）',
    'Project Kickoff': '项目启动会（Project Kickoff）',
    'Project Tracker': '项目进度追踪表（Project Tracker）',
    'Sales Pipeline': '销售漏斗（Sales Pipeline）',
    'Simple Dark Mode': '极简深色主题（Simple Dark Mode）',
    'Simple Light Mode': '极简浅色主题（Simple Light Mode）',
    'Strategy Memorandum': '战略备忘录（Strategy Memorandum）',
    'System Design': '系统设计（System Design）',
    'Team Alignment': '团队对齐（Team Alignment）',
    'Three-Statement Forecast': '三表财务预测（Three-Statement Forecast）',
  });

  const SCOPE_ZH = Object.freeze({
    app: '应用',
    repo: '仓库',
    project: '项目',
    personal: '个人',
    system: '系统',
    user: '用户',
    workspace: '工作区',
    global: '全局',
  });

  const EXACT_DESC_ZH = Object.freeze({
    'Run until the specified goal is completely finished.': '持续执行任务，直到指定目标彻底完成',
    'Set a goal Codex keeps working toward until it is done': '设定持续推进目标，让 Codex 一直执行直至彻底完成',
    'Run an instruction on a recurring schedule or as a one-time timer.': '按周期定时或一次性定时器执行指令',
    'Invoke a browser agent for web tasks.': '调用浏览器 Agent 执行网页任务',
    'Plan carefully before executing a task.': '执行任务前先进行周密的分步规划',
    'Interview me to align on a plan.': '通过交互式追问访谈来对齐方案细节',
    'Invoke a team of agents to autonomously tackle large projects.': '调用多 Agent 团队自主协作完成大型项目',
    'Reflect on recent successes or corrections to capture reusable skills or rules.': '复盘近期成功经验或纠错，沉淀可复用的 Skill 或规则',
    'Invoke the Boost multi-agent orchestrator for complex tasks.': '调用 Boost 多 Agent 编排器处理复杂任务',
    'Switch response model for this thread': '切换当前会话使用的回复模型',
    'Ask a side question in a new side chat': '在新侧边对话中提出旁支问题',
    'Same as /side': '同 /side（开启旁支提问）',
    'Start a fresh session; earlier messages stay visible': '开启全新上下文会话，保留历史消息可见',
    'Run provider command': '执行当前 Provider 命令',
    'Run provider skill': '调用当前 Provider 技能',
    "Show this provider's usage limits": '查看当前 Provider 的用量限额与配额',
    'Send this thread and Codex logs to OpenAI': '向 OpenAI 发送当前会话与 Codex 日志反馈',
  });

  function isMostlyChinese(text) {
    const s = String(text || '').trim();
    if (!s) return false;
    const cjk = (s.match(/[\u3400-\u9fff]/g) || []).length;
    const latin = (s.match(/[A-Za-z]/g) || []).length;
    return cjk >= 4 && cjk * 2 >= latin;
  }

  function extractCommandKey(itemId, label) {
    const id = String(itemId || '').trim();
    if (id) {
      if (id.startsWith('slash:')) return id.slice('slash:'.length).toLowerCase();
      if (id.startsWith('provider-slash-command:')) {
        const rest = id.slice('provider-slash-command:'.length);
        const colonIdx = rest.indexOf(':');
        return (colonIdx >= 0 ? rest.slice(colonIdx + 1) : rest).toLowerCase();
      }
      if (id.startsWith('skill:')) {
        const rest = id.slice('skill:'.length);
        const colonIdx = rest.indexOf(':');
        return (colonIdx >= 0 ? rest.slice(colonIdx + 1) : rest).toLowerCase();
      }
    }
    const lbl = String(label || '').trim();
    if (lbl.startsWith('/skill:')) return lbl.slice('/skill:'.length).trim().toLowerCase();
    if (lbl.startsWith('/')) return lbl.slice(1).trim().toLowerCase();
    return lbl.toLowerCase();
  }

  function isTranslatableItemId(itemId) {
    const id = String(itemId || '');
    return id.startsWith('slash:') || id.startsWith('provider-slash-command:') || id.startsWith('skill:');
  }

  function translateByPattern(desc) {
    const s = String(desc || '').trim();
    if (!s) return null;

    if (Object.prototype.hasOwnProperty.call(EXACT_DESC_ZH, s)) {
      return EXACT_DESC_ZH[s];
    }

    // OpenAI artifact template pattern
    const tmplMatch = s.match(/^Create\s+(spreadsheets|presentations|documents)\s+with\s+the\s+(.+?)\s+template\.?$/i);
    if (tmplMatch) {
      const kindMap = {
        spreadsheets: '电子表格',
        presentations: '演示文稿',
        documents: '文档',
      };
      const kindZh = kindMap[tmplMatch[1].toLowerCase()] || '文件';
      const rawName = tmplMatch[2].trim();
      const nameZh = TEMPLATE_NAME_ZH[rawName] || `「${rawName}」`;
      return `使用 ${nameZh} 模板创建${kindZh}`;
    }

    // Scope skill fallback ("personal skill", "project skill", etc.)
    const scopeMatch = s.match(/^([a-z]+)\s+skill\.?$/i);
    if (scopeMatch) {
      const scopeZh = SCOPE_ZH[scopeMatch[1].toLowerCase()];
      if (scopeZh) return `${scopeZh}级技能（${scopeMatch[1]} skill）`;
    }

    return null;
  }

  function translateCommandDescription({ itemId = '', label = '', description = '' } = {}) {
    const orig = String(description || '').trim();
    if (!orig) return null;
    if (isMostlyChinese(orig)) return null;

    // 1. Exact description override (keeps provider-specific nuances like Antigravity vs Codex /goal)
    const byPattern = translateByPattern(orig);
    if (byPattern) return byPattern;

    // 2. Exact command/skill key match (full namespaced key first, then bare suffix after `:`)
    const fullKey = extractCommandKey(itemId, label);
    if (fullKey) {
      if (Object.prototype.hasOwnProperty.call(COMMAND_ZH_MAP, fullKey)) {
        return COMMAND_ZH_MAP[fullKey];
      }
      const lastColon = fullKey.lastIndexOf(':');
      if (lastColon >= 0) {
        const bareKey = fullKey.slice(lastColon + 1);
        if (Object.prototype.hasOwnProperty.call(COMMAND_ZH_MAP, bareKey)) {
          return COMMAND_ZH_MAP[bareKey];
        }
      }
    }

    return null;
  }

  function createCommandI18n({ configStore }) {
    let destroyed = false;
    let drawerObserver = null;
    let rafPending = false;
    const activeDescMap = new Map(); // origEnglishDesc -> zhDesc

    function clearLocalizedNodes(rootNode) {
      const scope = rootNode || document;
      scope.querySelectorAll('.t3op-cmd-zh-desc').forEach((n) => n.remove());
      scope.querySelectorAll('[data-t3op-cmd-orig-hidden="1"]').forEach((n) => {
        n.removeAttribute('data-t3op-cmd-orig-hidden');
      });
      activeDescMap.clear();
    }

    function localizeDrawer(drawer) {
      if (!drawer || !drawer.isConnected) return;
      const items = drawer.querySelectorAll('[data-composer-item-id]');
      for (const itemEl of items) {
        const itemId = itemEl.getAttribute('data-composer-item-id') || '';
        if (!isTranslatableItemId(itemId)) continue;

        const row = itemEl.querySelector(':scope > span.flex') || itemEl.querySelector('span.flex');
        if (!row) continue;

        const directSpans = Array.from(row.children).filter(
          (el) => el.tagName === 'SPAN' && !el.hasAttribute('data-t3op-owned')
        );
        if (directSpans.length < 2) continue;

        const labelSpan = directSpans[0];
        const origDescSpan =
          row.querySelector(':scope > span.flex-1:not([data-t3op-owned="1"])') || directSpans[1];
        if (!origDescSpan || origDescSpan === labelSpan) continue;

        const labelText = (labelSpan.textContent || '').trim();
        const origText = (origDescSpan.textContent || '').trim();
        const existingZh = row.querySelector(':scope > .t3op-cmd-zh-desc');

        const zhText = translateCommandDescription({
          itemId,
          label: labelText,
          description: origText,
        });

        if (!zhText || zhText === origText) {
          if (origDescSpan.hasAttribute('data-t3op-cmd-orig-hidden')) {
            origDescSpan.removeAttribute('data-t3op-cmd-orig-hidden');
          }
          if (existingZh) existingZh.remove();
          continue;
        }

        activeDescMap.set(origText, zhText);
        if (origDescSpan.getAttribute('data-t3op-cmd-orig-hidden') !== '1') {
          origDescSpan.setAttribute('data-t3op-cmd-orig-hidden', '1');
        }

        let zhSpan = existingZh;
        if (!zhSpan) {
          zhSpan = document.createElement('span');
          zhSpan.className = 't3op-cmd-zh-desc';
          zhSpan.setAttribute('data-t3op-owned', '1');
          origDescSpan.insertAdjacentElement('afterend', zhSpan);
        }
        if (zhSpan.textContent !== zhText) {
          zhSpan.textContent = zhText;
        }
        const fullTitle = `${zhText}\n${origText}`;
        if (zhSpan.title !== fullTitle) {
          zhSpan.title = fullTitle;
        }
      }
    }

    function localizeTooltips() {
      if (activeDescMap.size === 0) return;
      document.querySelectorAll('[data-slot="tooltip-popup"]').forEach((tip) => {
        if (tip.hasAttribute('data-t3op-owned')) return;
        const txt = (tip.textContent || '').trim();
        const zh = activeDescMap.get(txt);
        if (!zh) return;
        if (tip.getAttribute('data-t3op-tip-src') === txt) return;
        tip.setAttribute('data-t3op-tip-src', txt);
        const existing = tip.querySelector('.t3op-cmd-zh-tip');
        if (!existing) {
          const wrap = document.createElement('div');
          wrap.className = 't3op-cmd-zh-tip';
          wrap.setAttribute('data-t3op-owned', '1');
          wrap.style.cssText = 'font-weight:500;margin-bottom:4px;color:var(--t3op-fg,inherit)';
          wrap.textContent = zh;
          tip.insertBefore(wrap, tip.firstChild);
        } else {
          existing.textContent = zh;
        }
      });
    }

    function syncNow() {
      if (destroyed) return;
      const cfg = configStore.get();
      if (!cfg.commandI18n) {
        clearLocalizedNodes(document);
        return;
      }
      const drawers = document.querySelectorAll('[data-composer-command-drawer="true"]');
      if (drawers.length === 0) {
        activeDescMap.clear();
        return;
      }
      for (const drawer of drawers) {
        localizeDrawer(drawer);
      }
      localizeTooltips();
    }

    function scheduleSync() {
      if (destroyed || rafPending) return;
      rafPending = true;
      const run = () => {
        rafPending = false;
        syncNow();
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(run);
      } else {
        setTimeout(run, 0);
      }
    }

    function start() {
      if (destroyed || drawerObserver || typeof MutationObserver !== 'function' || !document.body) return;
      drawerObserver = new MutationObserver((records) => {
        if (destroyed) return;
        for (const rec of records) {
          const target = rec.target;
          if (target?.closest?.('[data-t3op-owned="1"]')) continue;
          if (
            target?.closest?.('[data-composer-drawer-layer="true"], [data-composer-command-drawer="true"], [data-slot="tooltip-popup"]')
          ) {
            scheduleSync();
            return;
          }
          if (rec.addedNodes && rec.addedNodes.length > 0) {
            for (const node of rec.addedNodes) {
              if (node.nodeType !== 1) continue;
              if (node.hasAttribute?.('data-t3op-owned')) continue;
              if (
                node.matches?.('[data-composer-drawer-layer="true"], [data-composer-command-drawer="true"], [data-composer-item-id], [data-slot="tooltip-popup"]') ||
                node.querySelector?.('[data-composer-command-drawer="true"], [data-composer-item-id]')
              ) {
                scheduleSync();
                return;
              }
            }
          }
        }
      });
      drawerObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      syncNow();
    }

    function destroy() {
      destroyed = true;
      if (drawerObserver) {
        try {
          drawerObserver.disconnect();
        } catch {}
        drawerObserver = null;
      }
      clearLocalizedNodes(document);
      document.querySelectorAll('.t3op-cmd-zh-tip').forEach((n) => n.remove());
      document.querySelectorAll('[data-t3op-tip-src]').forEach((n) => n.removeAttribute('data-t3op-tip-src'));
    }

    return {
      start,
      refresh: syncNow,
      destroy,
    };
  }

  const api = {
    COMMAND_ZH_MAP,
    TEMPLATE_NAME_ZH,
    isMostlyChinese,
    extractCommandKey,
    isTranslatableItemId,
    translateCommandDescription,
    createCommandI18n,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  G.__t3OpCommandI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
