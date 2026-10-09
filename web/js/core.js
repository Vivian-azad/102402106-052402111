/**
 * core.js —— 纯函数核心逻辑（无 DOM、无 localStorage 依赖）
 * ------------------------------------------------------------------
 * 设计目的：把「校园失物招领」的核心业务规则抽成纯函数，
 * 使它们既能被浏览器前端调用，也能被 Node 单元测试直接 import 验证。
 * 这是本次作业「逻辑层与表现层解耦」的关键：同一份逻辑，两种环境共用。
 *
 * 支持的环境：
 *   - 浏览器：<script src="js/core.js"> 挂载到 window.Core
 *   - Node（单元测试）：module.exports 导出
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.Core = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {

  /* ============================================================
   * 常量与枚举
   * ============================================================ */
  const ITEM_TYPE = ['寻物', '招领']

  // 信息状态机：作业要求的终态是「已找到 / 已归还」，
  // 这里统一为「进行中 / 已找到 / 已归还」，并按类型区分终态文案。
  const STATUS = {
    ACTIVE: '进行中',      // 对外可见、可联系
    FOUND: '已找到',       // 寻物终态
    RETURNED: '已归还'     // 招领终态
  }

  const CATEGORY_LIST = ['证件卡类', '电子产品', '衣物', '学习用品', '生活用品', '配饰', '钥匙', '其他']

  const PLACE_LIST = ['图书馆', '食堂', '教学楼', '宿舍区', '体育馆', '其他']

  // 时间范围
  const TIME_RANGE = { all: '全部', today: '今天', '3d': '近三天', '7d': '近一周' }

  /* ============================================================
   * 工具函数
   * ============================================================ */
  function pad(n) { return n < 10 ? '0' + n : '' + n }

  function formatDateTime(d) {
    d = d || new Date()
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
  }

  function nowStr() { return formatDateTime(new Date()) }

  function uid(prefix) {
    return (prefix || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }

  function daysAgo(n) {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
  }

  // 时间范围起点（今天 00:00 / 近三天 / 近一周），all 返回 null
  function rangeStart(range) {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    if (range === 'today') return d
    if (range === '3d') { d.setDate(d.getDate() - 3); return d }
    if (range === '7d') { d.setDate(d.getDate() - 7); return d }
    return null
  }

  /* ============================================================
   * 地点归一化
   * 兼容「教学楼A / 教学楼A栋 / 教A / 操场 / 饭堂」等历史脏值写法
   * ============================================================ */
  function normPlace(v) {
    let s = String(v == null ? '' : v).trim()
    if (!s) return ''
    s = s.replace(/[栋幢座]$/, '')
    const alias = {
      '教学楼A': '教学楼', '教学楼B': '教学楼', '教学楼C': '教学楼',
      '教A': '教学楼', '教B': '教学楼', '教C': '教学楼',
      '操场': '体育馆', '运动场': '体育馆', '田径场': '体育馆', '体育场地': '体育馆',
      '饭堂': '食堂', '一食堂': '食堂', '二食堂': '食堂', '三食堂': '食堂',
      '宿舍': '宿舍区'
    }
    return alias[s] || s
  }

  function matchPlace(itemPlace, want) {
    if (!want) return true
    return normPlace(itemPlace) === normPlace(want)
  }

  /* ============================================================
   * 状态与可见性
   * ============================================================ */
  // 前台只展示「进行中」的信息；已找到/已归还的信息从公共列表移除，
  // 避免重复询问。这是「更新状态后别人在哪看到结果」的核心规则。
  function isVisible(item) {
    return item && item.status === STATUS.ACTIVE
  }

  // 根据类型给出对应的终态文案：寻物 → 已找到，招领 → 已归还
  function terminalStatus(type) {
    return type === '招领' ? STATUS.RETURNED : STATUS.FOUND
  }

  /* ============================================================
   * 搜索 / 过滤（核心业务逻辑，单元测试重点）
   * ============================================================ */
  /**
   * 对信息列表做组合过滤
   * @param {Array} items 全量信息（已按时间倒序）
   * @param {Object} q { type, place, keyword, timeRange, status }
   * @returns {Array} 过滤后的列表
   */
  function filterItems(items, q) {
    q = q || {}
    let list = (items || []).slice()

    // 类型：寻物 / 招领
    if (q.type) list = list.filter(it => it.type === q.type)

    // 地点：归一化后精确匹配
    if (q.place) list = list.filter(it => matchPlace(it.place, q.place))

    // 关键词：匹配物品名称 + 描述（忽略大小写）
    if (q.keyword) {
      const k = String(q.keyword).trim().toLowerCase()
      if (k) {
        list = list.filter(it =>
          (it.title || '').toLowerCase().indexOf(k) > -1 ||
          (it.description || '').toLowerCase().indexOf(k) > -1
        )
      }
    }

    // 时间范围：按 createTime 过滤
    if (q.timeRange && q.timeRange !== 'all') {
      const s = rangeStart(q.timeRange)
      if (s) {
        list = list.filter(it => new Date(String(it.createTime || '').replace(/-/g, '/')) >= s)
      }
    }

    // 状态：默认只显示「进行中」
    const wantStatus = q.status || STATUS.ACTIVE
    list = list.filter(it => it.status === wantStatus)

    return list
  }

  /* ============================================================
   * 发布校验（异常分支，单元测试重点）
   * ============================================================ */
  /**
   * 校验发布表单，返回 { ok, errors }
   * @param {Object} data { type, title, description, place, category, time, contact }
   */
  function validatePublish(data) {
    data = data || {}
    const errors = []

    if (ITEM_TYPE.indexOf(data.type) === -1) {
      errors.push('请选择信息类型（寻物 / 招领）')
    }
    if (!String(data.title || '').trim()) {
      errors.push('请填写物品名称')
    } else if (String(data.title).trim().length > 30) {
      errors.push('物品名称不能超过 30 个字符')
    }
    if (!String(data.place || '').trim()) {
      errors.push('请选择遗失 / 拾取地点')
    }
    if (!String(data.contact || '').trim()) {
      errors.push('请填写联系方式')
    }
    if (String(data.description || '').trim().length > 200) {
      errors.push('描述不能超过 200 个字符')
    }

    return { ok: errors.length === 0, errors }
  }

  /* ============================================================
   * 类别图标解析（与小程序 category.js 一致）
   * ============================================================ */
  const CATE_ICON = {
    '证件卡类': 'card',
    '电子产品': 'earbuds',
    '衣物': 'jacket',
    '学习用品': 'book',
    '生活用品': 'bottle',
    '配饰': 'glasses',
    '钥匙': 'key'
  }
  const CATE_ALIAS = { '衣物配饰': '衣物' }

  function tidy(v) {
    if (v === null || v === undefined) return ''
    let s = String(v)
    s = s.replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '').trim()
    for (let i = 0; i < 3; i++) {
      const m = s.match(/^['"“”‘’`]+(.+?)['"“”‘’`]+$/)
      if (m) s = m[1].trim()
      else break
    }
    s = s.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    return s.trim()
  }

  // 返回图标 key（用于映射到 emoji / 图片）
  function resolveCategoryIcon(category, type) {
    const c = tidy(category)
    let key = ''
    if (c) {
      key = CATE_ICON[c]
      if (!key && CATE_ALIAS[c]) key = CATE_ICON[CATE_ALIAS[c]]
      if (!key && c.length >= 2) {
        const hit = Object.keys(CATE_ICON).find(k => k.indexOf(c) > -1 || c.indexOf(k) > -1)
        if (hit) key = CATE_ICON[hit]
      }
    }
    const matched = !!key
    if (!key) key = (type === '招领' ? 'wallet' : 'bag')
    return { key, matched }
  }

  // 类别 → emoji（WEB 端展示用，替代小程序里的 png 图标）
  const CATE_EMOJI = {
    card: '💳', earbuds: '🎧', jacket: '🧥', book: '📚',
    bottle: '🥤', glasses: '👓', key: '🔑', wallet: '👛', bag: '🎒'
  }
  function categoryEmoji(category, type) {
    const r = resolveCategoryIcon(category, type)
    return CATE_EMOJI[r.key] || '🎒'
  }

  /* ============================================================
   * 导出
   * ============================================================ */
  return {
    ITEM_TYPE,
    STATUS,
    CATEGORY_LIST,
    PLACE_LIST,
    TIME_RANGE,
    pad, formatDateTime, nowStr, uid, daysAgo, rangeStart,
    normPlace, matchPlace,
    isVisible, terminalStatus,
    filterItems,
    validatePublish,
    tidy, resolveCategoryIcon, categoryEmoji
  }
})
