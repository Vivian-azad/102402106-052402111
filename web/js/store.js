/**
 * store.js —— 数据访问层（localStorage 持久化）
 * ------------------------------------------------------------------
 * 数据存于浏览器 localStorage，键为 'clf-db'。
 * 首次打开自动写入种子数据；之后所有发布、改状态、删除都持久化。
 * 封装了增删改查，页面只调用这里的方法，不直接碰 localStorage。
 *
 * 关键设计：状态流转闭环
 *   发布(进行中) → 发布者标记「已找到/已归还」→ 从公共列表消失，仍出现在「我的发布」
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./core.js'), require('./seed.js'))
  } else {
    root.Store = factory(root.Core, root.Seed)
  }
})(typeof self !== 'undefined' ? self : this, function (Core, Seed) {

  const KEY = 'clf-db'
  let db = null

  /* ---------------- 持久化 ---------------- */
  function load() {
    if (db) return db
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) {
        db = JSON.parse(raw)
        if (db && db.items) return db
      }
    } catch (e) { /* 解析失败则重置 */ }
    db = Seed.seed()
    save()
    return db
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch (e) { /* 忽略写入失败 */ }
  }

  // 重置为初始种子数据（演示用）
  function reset() {
    db = Seed.seed()
    save()
    return db
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)) }

  /* ---------------- 用户 ---------------- */
  function getMe() {
    return clone(load().me)
  }

  /* ---------------- 物品：前台 ---------------- */
  // 按条件列出（默认只列「进行中」），返回按时间倒序的列表
  function listItems(q) {
    const all = load().items.slice().sort((a, b) =>
      String(b.createTime).localeCompare(String(a.createTime))
    )
    const filtered = Core.filterItems(all, q)
    return filtered.map(decorate)
  }

  function getItem(id) {
    const it = load().items.find(x => x._id === id)
    return it ? decorate(clone(it)) : null
  }

  function decorate(it) {
    const u = load().users.find(x => x._id === it.publisherId)
    it.publisherName = u ? u.nickname : '匿名用户'
    return it
  }

  // 发布：校验通过后写入，状态初始为「进行中」
  function createItem(data) {
    const check = Core.validatePublish(data)
    if (!check.ok) {
      return { ok: false, errors: check.errors }
    }
    const it = {
      _id: Core.uid('i'),
      type: data.type,
      title: String(data.title).trim(),
      description: String(data.description || '').trim(),
      place: data.place,
      category: data.category || '其他',
      time: data.time || Core.nowStr().slice(0, 10),
      contact: String(data.contact).trim(),
      status: Core.STATUS.ACTIVE,
      publisherId: load().me._id,
      createTime: Core.nowStr()
    }
    load().items.unshift(it)
    save()
    return { ok: true, item: clone(it) }
  }

  // 更新状态（发布者自助）：进行中 → 已找到/已归还
  function updateItemStatus(id, status) {
    const it = load().items.find(x => x._id === id)
    if (!it) return { ok: false, error: '信息不存在' }
    if (it.publisherId !== load().me._id) return { ok: false, error: '只能修改自己发布的信息' }
    if (status !== Core.STATUS.FOUND && status !== Core.STATUS.RETURNED && status !== Core.STATUS.ACTIVE) {
      return { ok: false, error: '非法状态' }
    }
    it.status = status
    it.updateTime = Core.nowStr()
    save()
    return { ok: true }
  }

  // 编辑自己发布的信息
  function updateItem(id, data) {
    const it = load().items.find(x => x._id === id)
    if (!it) return { ok: false, error: '信息不存在' }
    if (it.publisherId !== load().me._id) return { ok: false, error: '只能修改自己发布的信息' }
    const check = Core.validatePublish(data)
    if (!check.ok) return { ok: false, errors: check.errors }
    it.type = data.type
    it.title = String(data.title).trim()
    it.description = String(data.description || '').trim()
    it.place = data.place
    it.category = data.category || '其他'
    it.time = data.time || it.time
    it.contact = String(data.contact).trim()
    it.updateTime = Core.nowStr()
    save()
    return { ok: true, item: clone(it) }
  }

  // 删除自己发布的信息
  function removeItem(id) {
    const it = load().items.find(x => x._id === id)
    if (!it) return { ok: false, error: '信息不存在' }
    if (it.publisherId !== load().me._id) return { ok: false, error: '只能删除自己发布的信息' }
    db.items = db.items.filter(x => x._id !== id)
    save()
    return { ok: true }
  }

  // 我的发布：全部（含已找到/已归还）
  function listMyItems() {
    return load().items
      .filter(it => it.publisherId === load().me._id)
      .sort((a, b) => String(b.createTime).localeCompare(String(a.createTime)))
      .map(decorate)
  }

  /* ---------------- 地点 ---------------- */
  function listPlaces() {
    return clone(load().places)
  }

  return {
    load, save, reset, getMe,
    listItems, getItem, createItem, updateItemStatus, updateItem, removeItem, listMyItems,
    listPlaces
  }
})
