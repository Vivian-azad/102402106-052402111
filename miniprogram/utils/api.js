// ============================================================
// 数据层：统一接口，云开发 / Mock 双实现
// 页面只调用本文件暴露的方法，不关心底层数据源。
// ============================================================
const cfg = require('../config.js')
const seed = require('./mockData.js').seed
const { uid, nowStr, formatDateTime, rangeStart } = require('./util.js')

let g = null          // app globalData
let me = null         // 当前登录用户
let DB = null         // wx.cloud.database() 实例（仅云模式）
let CMD = null        // db.command
let userCache = null  // 云模式用户昵称映射缓存

// —— Mock 内存库 ——
let store = null

function init(globalData) {
  g = globalData
  if (!g.useMock && g.env && wx.cloud) {
    DB = wx.cloud.database()
    CMD = DB.command
  } else {
    store = seed()
  }
}

function isMock() { return g.useMock || !DB }

/* ---------------- 登录 / 用户 ---------------- */

function login() {
  if (isMock()) {
    me = store.users[0] // 默认以“林小满（已认证）”身份登录，便于直接体验发布/联系
    return Promise.resolve(clone(me))
  }
  return wx.cloud.callFunction({ name: 'login' })
    .then(res => {
      const openid = res.result.openid
      return DB.collection('users').where({ _openid: openid }).get()
    })
    .then(r => {
      if (r.data && r.data.length) {
        me = r.data[0]
      } else {
        const doc = {
          nickname: '微信用户', realName: '', studentId: '', college: '',
          phone: '', cardImage: '', authStatus: '未认证', authReason: '',
          role: '学生', status: '正常', createTime: nowStr()
        }
        return DB.collection('users').add({ data: doc }).then(add => {
          return DB.collection('users').doc(add._id).get()
        }).then(rr => { me = rr.data; return me })
      }
      return me
    })
    .then(u => {
      // 管理员白名单
      if (g.adminOpenids && g.adminOpenids.indexOf(u._openid) > -1) {
        u.role = '管理员'
        return DB.collection('users').doc(u._id).update({ data: { role: '管理员' } }).then(() => u)
      }
      return u
    })
    .then(u => clone(u))
}

function getMe() {
  if (!me) return login() // 登录尚未完成时兜底，确保拿到当前用户
  return Promise.resolve(clone(me))
}

function updateUser(data) {
  if (isMock()) {
    Object.assign(me, data)
    const u = store.users.find(x => x._id === me._id)
    if (u) Object.assign(u, data)
    return Promise.resolve(clone(me))
  }
  const { _id } = me
  return DB.collection('users').doc(_id).update({ data })
    .then(() => DB.collection('users').doc(_id).get())
    .then(r => { me = r.data; return clone(me) })
}

// 提交实名认证
function submitAuth(data) {
  const patch = Object.assign({ authStatus: '审核中', authReason: '' }, data)
  return updateUser(patch)
}

function isAdmin() {
  return me && (me.role === '管理员')
}

/* ---------------- 工具 ---------------- */

function clone(o) { return JSON.parse(JSON.stringify(o)) }

// 给物品附加发布者昵称
function decorateMockItem(it) {
  const u = store.users.find(x => x._id === it.publisherId)
  it.publisherName = u ? u.nickname : '匿名用户'
  return it
}

// 云模式：批量取用户昵称映射
function cloudUserMap() {
  if (userCache) return Promise.resolve(userCache)
  return DB.collection('users').get().then(r => {
    const m = {}
    r.data.forEach(u => { m[u._id] = u.nickname })
    userCache = m
    return m
  })
}
function decorateCloudItem(it, map) {
  it.publisherName = (map && map[it.publisherId]) || '匿名用户'
  return it
}

// 前台可见状态：只保留“已通过”
// “已完成 / 已找到 / 已归还”以及历史遗留的“进行中”都不再对外展示
const HIDE = ['已完成', '进行中']
const VISIBLE = ['已通过']

function isVisible(it) {
  const s = String((it && it.status) || '').trim()
  if (HIDE.indexOf(s) > -1) return false
  return VISIBLE.indexOf(s) > -1
}

// 地点归一化：兼容历史数据里的“教学楼A / 教学楼A栋 / 教学楼B栋”等写法
function normPlace(v) {
  let s = String(v || '').trim()
  if (!s) return ''
  s = s.replace(/[栋幢座]$/, '')
  const alias = {
    '教学楼A': '教学楼', '教学楼B': '教学楼', '教学楼C': '教学楼',
    '教A': '教学楼', '教B': '教学楼', '教C': '教学楼',
    '操场': '体育馆', '运动场': '体育馆', '田径场': '体育馆', '体育场地': '体育馆',
    '饭堂': '食堂', '一食堂': '食堂', '二食堂': '食堂', '三食堂': '食堂'
  }
  return alias[s] || s
}

function matchPlace(itemPlace, want) {
  if (!want) return true
  return normPlace(itemPlace) === normPlace(want)
}

/* ---------------- 物品：前台 ---------------- */

function listItems(q) {
  q = q || {}
  if (isMock()) {
    let list = store.items.filter(isVisible)
    if (q.type) list = list.filter(it => it.type === q.type)
    if (q.place) list = list.filter(it => matchPlace(it.place, q.place))
    if (q.keyword) {
      const k = q.keyword.toLowerCase()
      list = list.filter(it => it.title.toLowerCase().indexOf(k) > -1)
    }
    if (q.timeRange && q.timeRange !== 'all') {
      const s = rangeStart(q.timeRange)
      if (s) list = list.filter(it => new Date(it.time.replace(/-/g, '/')) >= s)
    }
    list.sort((a, b) => b.createTime.localeCompare(a.createTime))
    const total = list.length
    const skip = q.skip || 0
    const limit = q.limit || 20
    list = list.slice(skip, skip + limit).map(decorateMockItem)
    return Promise.resolve({ list, total })
  }
  // 云模式：拉取后前端过滤（规避 status 值含空格/隐藏字符导致 where-in 匹配失败）
  return DB.collection('items').orderBy('createTime', 'desc').limit(100).get()
    .then(r => {
      let list = (r.data || []).slice()
      console.log('[listItems] 拉取', list.length, '条 | status 精确值 →',
        list.map(x => x.title + ':' + JSON.stringify(x.status)).join(' | '))
      list = list.filter(isVisible)
      if (q.type) list = list.filter(it => it.type === q.type)
      if (q.place) list = list.filter(it => matchPlace(it.place, q.place))
      if (q.keyword) {
        const k = q.keyword.toLowerCase()
        list = list.filter(it => (it.title || '').toLowerCase().indexOf(k) > -1)
      }
      if (q.timeRange && q.timeRange !== 'all') {
        const s = rangeStart(q.timeRange)
        if (s) {
          const st = formatDateTime(s)
          list = list.filter(it => String(it.time || it.createTime || '') >= st)
        }
      }
      list.sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
      const total = list.length
      const skip = q.skip || 0
      const limit = q.limit || 20
      list = list.slice(skip, skip + limit)
      return cloudUserMap().then(map => ({
        list: list.map(it => decorateCloudItem(it, map)),
        total
      }))
    })
}

function getItem(id) {
  if (!id) return Promise.resolve(null)
  if (isMock()) {
    const it = store.items.find(x => x._id === id)
    return Promise.resolve(it ? decorateMockItem(clone(it)) : null)
  }
  return DB.collection('items').doc(id).get()
    .then(r => cloudUserMap().then(map => decorateCloudItem(r.data, map)))
}

function createItem(data) {
  if (isMock()) {
    const it = Object.assign({
      _id: uid('i'), publisherId: me._id, status: '已通过', auditReason: '',
      images: [], createTime: nowStr()
    }, data)
    store.items.unshift(it)
    return Promise.resolve(clone(it))
  }
  const doc = Object.assign({
    publisherId: me._id, status: '已通过', auditReason: '',
    images: [], createTime: nowStr()
  }, data)
  return DB.collection('items').add({ data: doc })
    .then(add => DB.collection('items').doc(add._id).get())
    .then(r => r.data)
}

function updateItemStatus(id, status, auditReason) {
  const patch = { status }
  if (auditReason !== undefined) patch.auditReason = auditReason
  if (isMock()) {
    const it = store.items.find(x => x._id === id)
    if (it) Object.assign(it, patch)
    return Promise.resolve(true)
  }
  return DB.collection('items').doc(id).update({ data: patch }).then(() => true)
}

// —— 发布者自助：修改自己发布的信息 ——
function updateItem(id, data) {
  // 只允许改这些字段，避免越权改动 status / publisherId 等
  const allow = ['type', 'title', 'description', 'place', 'category', 'time', 'contact', 'images']
  const patch = {}
  allow.forEach(k => { if (data && data[k] !== undefined) patch[k] = data[k] })
  // 记录最后一次修改时间，便于列表排序与排查
  patch.updateTime = nowStr()

  if (isMock()) {
    const it = store.items.find(x => x._id === id)
    if (!it) return Promise.reject({ msg: '信息不存在' })
    if (it.publisherId !== me._id) return Promise.reject({ msg: '只能修改自己发布的信息' })
    Object.assign(it, patch)
    return Promise.resolve(clone(it))
  }
  return DB.collection('items').doc(id).get()
    .then(r => {
      const it = r.data || {}
      if (it.publisherId !== me._id) throw { msg: '只能修改自己发布的信息' }
      return DB.collection('items').doc(id).update({ data: patch })
    })
    .then(() => DB.collection('items').doc(id).get())
    .then(r => r.data)
}

// —— 发布者自助：删除自己发布的信息 ——
function removeItem(id) {
  if (isMock()) {
    const it = store.items.find(x => x._id === id)
    if (!it) return Promise.reject({ msg: '信息不存在' })
    if (it.publisherId !== me._id) return Promise.reject({ msg: '只能删除自己发布的信息' })
    store.items = store.items.filter(x => x._id !== id)
    return Promise.resolve(true)
  }
  return DB.collection('items').doc(id).get()
    .then(r => {
      const it = r.data || {}
      if (it.publisherId !== me._id) throw { msg: '只能删除自己发布的信息' }
      return DB.collection('items').doc(id).remove()
    })
    .then(() => true)
}

function listMyItems() {
  if (isMock()) {
    const list = store.items.filter(it => it.publisherId === me._id)
      .sort((a, b) => b.createTime.localeCompare(a.createTime))
      .map(decorateMockItem)
    return Promise.resolve(list)
  }
  return DB.collection('items').where({ publisherId: me._id })
    .orderBy('createTime', 'desc').get()
    .then(r => cloudUserMap().then(map => r.data.map(it => decorateCloudItem(it, map))))
}

/* ---------------- 举报 ---------------- */

function createReport(itemId, reason) {
  if (isMock()) {
    const r = { _id: uid('r'), itemId, reporterId: me._id, reason, status: '待处理', createTime: nowStr() }
    store.reports.unshift(r)
    return Promise.resolve(clone(r))
  }
  return DB.collection('reports').add({
    data: { itemId, reporterId: me._id, reason, status: '待处理', createTime: nowStr() }
  }).then(() => true)
}

/* ---------------- 后台：统计 ---------------- */

function adminStats() {
  if (isMock()) {
    const today = formatDateTime(rangeStart('today'))
    return Promise.resolve({
      todayNew: store.items.filter(it => it.createTime >= today).length,
      pendingItem: store.items.filter(it => it.status === '待审核').length,
      pendingAuth: store.users.filter(u => u.authStatus === '审核中').length,
      userTotal: store.users.length
    })
  }
  const today = formatDateTime(rangeStart('today'))
  return Promise.all([
    DB.collection('items').where({ createTime: CMD.gte(today) }).count(),
    DB.collection('items').where({ status: '待审核' }).count(),
    DB.collection('users').where({ authStatus: '审核中' }).count(),
    DB.collection('users').count()
  ]).then(([a, b, c, d]) => ({
    todayNew: a.total, pendingItem: b.total, pendingAuth: c.total, userTotal: d.total
  }))
}

/* ---------------- 后台：信息审核 ---------------- */

function adminListItems(q) {
  q = q || {}
  if (isMock()) {
    let list = clone(store.items)
    if (q.status && q.status !== '全部') list = list.filter(it => it.status === q.status)
    if (q.type && q.type !== '全部') list = list.filter(it => it.type === q.type)
    if (q.keyword) {
      const k = q.keyword.toLowerCase()
      list = list.filter(it => it.title.toLowerCase().indexOf(k) > -1)
    }
    list.sort((a, b) => b.createTime.localeCompare(a.createTime))
    return Promise.resolve({ list, total: list.length })
  }
  // 云模式：拉取后前端过滤（与 listItems 同策略，规避字段值差异）
  return DB.collection('items').orderBy('createTime', 'desc').limit(100).get()
    .then(r => {
      let list = (r.data || []).slice()
      if (q.status && q.status !== '全部') list = list.filter(it => String(it.status || '').trim() === q.status)
      if (q.type && q.type !== '全部') list = list.filter(it => it.type === q.type)
      if (q.keyword) {
        const k = q.keyword.toLowerCase()
        list = list.filter(it => (it.title || '').toLowerCase().indexOf(k) > -1)
      }
      list.sort((a, b) => String(b.createTime || '').localeCompare(String(a.createTime || '')))
      return cloudUserMap().then(map => ({
        list: list.slice(0, q.limit || 20).map(it => decorateCloudItem(it, map)),
        total: list.length
      }))
    })
}

function adminReviewItem(id, pass, reason) {
  return updateItemStatus(id, pass ? '已通过' : '已驳回', pass ? '' : (reason || '审核未通过'))
}

/* ---------------- 后台：用户管理 ---------------- */

function adminListUsers(q) {
  q = q || {}
  if (isMock()) {
    let list = clone(store.users)
    if (q.authStatus && q.authStatus !== '全部') list = list.filter(u => u.authStatus === q.authStatus)
    if (q.keyword) {
      const k = q.keyword.toLowerCase()
      list = list.filter(u => (u.nickname + u.studentId + u.realName).toLowerCase().indexOf(k) > -1)
    }
    return Promise.resolve({ list, total: list.length })
  }
  const w = {}
  if (q.authStatus && q.authStatus !== '全部') w.authStatus = q.authStatus
  if (q.keyword) {
    // 云数据库对多字段模糊较受限，这里仅在 nickname 上做正则（演示用）
    w.nickname = DB.RegExp({ regexp: q.keyword, options: 'i' })
  }
  return DB.collection('users').where(w).orderBy('createTime', 'desc')
    .skip(q.skip || 0).limit(q.limit || 20).get()
    .then(r => ({ list: r.data, total: r.data.length }))
}

function adminReviewUser(id, pass, reason) {
  const patch = { authStatus: pass ? '已认证' : '已驳回' }
  if (!pass) patch.authReason = reason || '认证未通过'
  if (isMock()) {
    const u = store.users.find(x => x._id === id)
    if (u) Object.assign(u, patch)
    return Promise.resolve(true)
  }
  return DB.collection('users').doc(id).update({ data: patch }).then(() => true)
}

function adminSetUserStatus(id, status) {
  if (isMock()) {
    const u = store.users.find(x => x._id === id)
    if (u) u.status = status
    return Promise.resolve(true)
  }
  return DB.collection('users').doc(id).update({ data: { status } }).then(() => true)
}

/* ---------------- 后台：举报处理 ---------------- */

function listReports(q) {
  q = q || {}
  if (isMock()) {
    let list = clone(store.reports)
    if (q.status && q.status !== '全部') list = list.filter(r => r.status === q.status)
    // 附上被举报物品标题
    list.forEach(r => {
      const it = store.items.find(x => x._id === r.itemId)
      r.itemTitle = it ? it.title : '(已删除)'
      r.itemType = it ? it.type : ''
    })
    list.sort((a, b) => b.createTime.localeCompare(a.createTime))
    return Promise.resolve({ list, total: list.length })
  }
  return DB.collection('reports').where(q.status && q.status !== '全部' ? { status: q.status } : {})
    .orderBy('createTime', 'desc').get().then(r => {
      const ids = r.data.map(x => x.itemId)
      return DB.collection('items').where({ _id: CMD.in(ids) }).get().then(ir => {
        const m = {}; ir.data.forEach(it => { m[it._id] = it.title })
        r.data.forEach(x => { x.itemTitle = m[x.itemId] || '(已删除)' })
        return { list: r.data, total: r.data.length }
      })
    })
}

function handleReport(id, action) {
  if (isMock()) {
    const r = store.reports.find(x => x._id === id)
    if (r) {
      r.status = '已处理'
      if (action === 'down') {
        const it = store.items.find(x => x._id === r.itemId)
        if (it) it.status = '已下架'
      }
    }
    return Promise.resolve(true)
  }
  if (action === 'down') {
    return DB.collection('reports').doc(id).get().then(rr => {
      return DB.collection('items').doc(rr.data.itemId).update({ data: { status: '已下架' } })
        .then(() => DB.collection('reports').doc(id).update({ data: { status: '已处理' } }))
    }).then(() => true)
  }
  return DB.collection('reports').doc(id).update({ data: { status: '已处理' } }).then(() => true)
}

/* ---------------- 后台：地点管理 ---------------- */

function listPlaces() {
  if (isMock()) return Promise.resolve(clone(store.places))
  return DB.collection('places').orderBy('createTime', 'asc').get().then(r => r.data)
}
function addPlace(name) {
  if (isMock()) {
    const p = { _id: uid('p'), name }
    store.places.push(p)
    return Promise.resolve(clone(p))
  }
  return DB.collection('places').add({ data: { name, createTime: nowStr() } })
    .then(add => DB.collection('places').doc(add._id).get()).then(r => r.data)
}
function updatePlace(id, name) {
  if (isMock()) {
    const p = store.places.find(x => x._id === id)
    if (p) p.name = name
    return Promise.resolve(true)
  }
  return DB.collection('places').doc(id).update({ data: { name } }).then(() => true)
}
function deletePlace(id) {
  if (isMock()) {
    store.places = store.places.filter(x => x._id !== id)
    return Promise.resolve(true)
  }
  return DB.collection('places').doc(id).remove().then(() => true)
}

module.exports = {
  init, login, getMe, updateUser, submitAuth, isAdmin, isMock,
  listItems, getItem, createItem, updateItem, removeItem, updateItemStatus, listMyItems,
  createReport,
  adminStats, adminListItems, adminReviewItem,
  adminListUsers, adminReviewUser, adminSetUserStatus,
  listReports, handleReport,
  listPlaces, addPlace, updatePlace, deletePlace
}
