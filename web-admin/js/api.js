// Web 后台数据层：Mock / 微信云开发 双实现
(function () {
  const cfg = window.CFG
  const M = window.MOCK
  let useMock = cfg.useMock
  let db = null
  let me = null

  async function init() {
    if (useMock) {
      me = M.users.find(u => u.role === '管理员') || M.users[0]
      return
    }
    const tcb = window.tcb
    if (!tcb) { useMock = true; me = M.users.find(u => u.role === '管理员'); return }
    const app = tcb.init({ env: cfg.env })
    await app.auth().signInAnonymously()
    db = app.database()
    me = M.users.find(u => u.role === '管理员') // 演示用：以管理员身份
  }

  function isAdmin() { return me && me.role === '管理员' }

  // —— 统计 ——
  async function stats() {
    if (useMock) {
      const today = new Date().toISOString().slice(0, 10)
      return {
        todayNew: M.items.filter(it => it.createTime.indexOf(today) === 0).length,
        pendingItem: M.items.filter(it => it.status === '待审核').length,
        pendingAuth: M.users.filter(u => u.authStatus === '审核中').length,
        userTotal: M.users.length
      }
    }
    // tcb 简化版（演示）
    const [a, b, c, d] = await Promise.all([
      db.collection('items').where({ status: '待审核' }).count(),
      db.collection('users').where({ authStatus: '审核中' }).count(),
      db.collection('users').count(),
      db.collection('items').count()
    ])
    return { todayNew: 0, pendingItem: a.total, pendingAuth: b.total, userTotal: d.total + c.total }
  }

  // —— 信息审核 ——
  async function listItems(q) {
    q = q || {}
    if (useMock) {
      let list = M.items.slice()
      if (q.status && q.status !== '全部') list = list.filter(it => it.status === q.status)
      if (q.type && q.type !== '全部') list = list.filter(it => it.type === q.type)
      if (q.keyword) list = list.filter(it => it.title.toLowerCase().indexOf(q.keyword.toLowerCase()) > -1)
      list.sort((a, b) => b.createTime.localeCompare(a.createTime))
      // 附发布者昵称
      list.forEach(it => { const u = M.users.find(x => x._id === it.publisherId); it.pubName = u ? u.nickname : '匿名' })
      return list
    }
    const w = {}
    if (q.status && q.status !== '全部') w.status = q.status
    if (q.type && q.type !== '全部') w.type = q.type
    if (q.keyword) w.title = db.RegExp({ regexp: q.keyword, options: 'i' })
    const r = await db.collection('items').where(w).orderBy('createTime', 'desc').get()
    return r.data
  }

  async function reviewItem(id, pass, reason) {
    const status = pass ? '已通过' : '已驳回'
    const auditReason = pass ? '' : (reason || '审核未通过')
    if (useMock) {
      const it = M.items.find(x => x._id === id); if (it) { it.status = status; it.auditReason = auditReason }
      return
    }
    await db.collection('items').doc(id).update({ data: { status, auditReason } })
  }

  async function deleteItem(id) {
    if (useMock) { M.items = M.items.filter(x => x._id !== id); return }
    await db.collection('items').doc(id).remove()
  }

  // —— 用户管理 ——
  async function listUsers(q) {
    q = q || {}
    if (useMock) {
      let list = M.users.slice()
      if (q.authStatus && q.authStatus !== '全部') list = list.filter(u => u.authStatus === q.authStatus)
      if (q.keyword) {
        const k = q.keyword.toLowerCase()
        list = list.filter(u => (u.nickname + u.studentId + u.realName).toLowerCase().indexOf(k) > -1)
      }
      return list
    }
    const w = {}
    if (q.authStatus && q.authStatus !== '全部') w.authStatus = q.authStatus
    if (q.keyword) w.nickname = db.RegExp({ regexp: q.keyword, options: 'i' })
    const r = await db.collection('users').where(w).get()
    return r.data
  }

  async function reviewUser(id, pass, reason) {
    const patch = { authStatus: pass ? '已认证' : '已驳回' }
    if (!pass) patch.authReason = reason || '认证未通过'
    if (useMock) { const u = M.users.find(x => x._id === id); if (u) Object.assign(u, patch); return }
    await db.collection('users').doc(id).update({ data: patch })
  }

  async function setUserStatus(id, status) {
    if (useMock) { const u = M.users.find(x => x._id === id); if (u) u.status = status; return }
    await db.collection('users').doc(id).update({ data: { status } })
  }

  async function deleteUser(id) {
    if (useMock) { M.users = M.users.filter(x => x._id !== id); return }
    await db.collection('users').doc(id).remove()
  }

  // —— 举报处理 ——
  async function listReports(q) {
    q = q || {}
    if (useMock) {
      let list = M.reports.slice()
      if (q.status && q.status !== '全部') list = list.filter(r => r.status === q.status)
      list.forEach(r => { const it = M.items.find(x => x._id === r.itemId); r.itemTitle = it ? it.title : '(已删除)' })
      list.sort((a, b) => b.createTime.localeCompare(a.createTime))
      return list
    }
    const w = q.status && q.status !== '全部' ? { status: q.status } : {}
    const r = await db.collection('reports').where(w).get()
    return r.data
  }

  async function handleReport(id, action) {
    if (useMock) {
      const r = M.reports.find(x => x._id === id)
      if (r) { r.status = '已处理'; if (action === 'down') { const it = M.items.find(x => x._id === r.itemId); if (it) it.status = '已下架' } }
      return
    }
    if (action === 'down') {
      const rr = await db.collection('reports').doc(id).get()
      await db.collection('items').doc(rr.data.itemId).update({ data: { status: '已下架' } })
    }
    await db.collection('reports').doc(id).update({ data: { status: '已处理' } })
  }

  // —— 地点管理 ——
  async function listPlaces() { return useMock ? M.places.slice() : (await db.collection('places').get()).data }
  async function addPlace(name) {
    if (useMock) { const p = { _id: 'p' + Date.now(), name }; M.places.push(p); return p }
    return (await db.collection('places').add({ data: { name } })).data
  }
  async function updatePlace(id, name) {
    if (useMock) { const p = M.places.find(x => x._id === id); if (p) p.name = name; return }
    await db.collection('places').doc(id).update({ data: { name } })
  }
  async function deletePlace(id) {
    if (useMock) { M.places = M.places.filter(x => x._id !== id); return }
    await db.collection('places').doc(id).remove()
  }

  window.API = {
    init, isAdmin, stats, listItems, reviewItem, deleteItem,
    listUsers, reviewUser, setUserStatus, deleteUser,
    listReports, handleReport,
    listPlaces, addPlace, updatePlace, deletePlace
  }
})()
