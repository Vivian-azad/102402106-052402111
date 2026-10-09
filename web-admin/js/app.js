// Web 后台界面逻辑（原生 JS，无构建依赖）
const API = window.API
let current = 'overview'

const TITLES = { overview: '数据概览', items: '信息审核与管理', users: '用户管理', reports: '举报处理', places: '地点管理' }
const filters = { items: { type: '全部', status: '全部', keyword: '' }, users: { authStatus: '全部', keyword: '' }, reports: { status: '全部' } }

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])) }

function statusClass(s) {
  if (s === '待审核' || s === '审核中') return 'st-pending'
  if (s === '已通过') return 'st-progress'
  if (s === '已完成') return 'st-done'
  if (s === '已驳回' || s === '已下架') return 'st-reject'
  return ''
}
function typeClass(t) { return t === '寻物' ? 'tag-found' : 'tag-lost' }

function openModal(html) {
  document.getElementById('modalBox').innerHTML = html
  document.getElementById('modal').classList.remove('hidden')
}
function closeModal() { document.getElementById('modal').classList.add('hidden') }

function boot() {
  API.init().then(() => {
    document.getElementById('loginBtn').onclick = enter
  })
}
function enter() {
  document.getElementById('login').classList.add('hidden')
  document.getElementById('shell').classList.remove('hidden')
  navTo('overview')
}

function navTo(key) {
  current = key
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.key === key))
  document.getElementById('pageTitle').textContent = TITLES[key]
  render(key)
}

async function render(key) {
  if (key === 'overview') return renderOverview()
  if (key === 'items') return renderItems()
  if (key === 'users') return renderUsers()
  if (key === 'reports') return renderReports()
  if (key === 'places') return renderPlaces()
}

/* ---------- 数据概览 ---------- */
async function renderOverview() {
  const s = await API.stats()
  const cards = [
    { n: s.todayNew, l: '今日新增信息' },
    { n: s.pendingItem, l: '待审核信息' },
    { n: s.pendingAuth, l: '待审核认证' },
    { n: s.userTotal, l: '用户总数' }
  ].map(c => `<div class="stat-card"><div class="stat-num">${c.n}</div><div class="stat-label">${c.l}</div></div>`).join('')
  document.getElementById('content').innerHTML = `
    <div class="stat-grid">${cards}</div>
    <div class="trend"><div class="trend-title">发布趋势</div><div class="trend-ph">趋势图占位区（可接入图表库）</div></div>`
}

/* ---------- 信息审核 ---------- */
async function renderItems() {
  const f = filters.items
  const list = await API.listItems(f)
  const opts = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('')
  const rows = list.map(it => `
    <tr>
      <td>${esc(it._id)}</td>
      <td>${esc(it.title)}</td>
      <td><span class="tag ${typeClass(it.type)}">${it.type}</span></td>
      <td>${esc(it.pubName || it.publisherId)}</td>
      <td>${esc(it.createTime)}</td>
      <td><span class="tag ${statusClass(it.status)}">${it.status}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" data-action="viewItem" data-id="${it._id}">查看</button>
        <button class="btn btn-primary btn-sm" data-action="passItem" data-id="${it._id}">通过</button>
        <button class="btn btn-danger btn-sm" data-action="rejectItem" data-id="${it._id}">驳回</button>
        <button class="btn btn-ghost btn-sm" data-action="downItem" data-id="${it._id}">下架</button>
        <button class="btn btn-ghost btn-sm" data-action="delItem" data-id="${it._id}">删除</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty-tip">暂无数据</td></tr>`

  document.getElementById('content').innerHTML = `
    <div class="filters">
      <select id="f-type">${opts(['全部', '寻物', '招领'], f.type)}</select>
      <select id="f-status">${opts(['全部', '待审核', '已通过', '已驳回', '已下架', '已完成'], f.status)}</select>
      <input id="f-kw" placeholder="关键词" value="${esc(f.keyword)}" />
      <button class="btn btn-primary" id="f-search">筛选</button>
    </div>
    <table class="table"><thead><tr>
      <th>ID</th><th>物品名称</th><th>类型</th><th>发布者</th><th>发布时间</th><th>状态</th><th>操作</th>
    </tr></thead><tbody>${rows}</tbody></table>`

  document.getElementById('f-search').onclick = () => {
    filters.items.type = document.getElementById('f-type').value
    filters.items.status = document.getElementById('f-status').value
    filters.items.keyword = document.getElementById('f-kw').value.trim()
    renderItems()
  }
}

/* ---------- 用户管理 ---------- */
async function renderUsers() {
  const f = filters.users
  const list = await API.listUsers(f)
  const opts = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('')
  const rows = list.map(u => `
    <tr>
      <td>${esc(u._id)}</td>
      <td>${esc(u.nickname)}</td>
      <td>${esc(u.studentId)}</td>
      <td>${esc(u.realName)}</td>
      <td><span class="tag ${statusClass(u.authStatus)}">${u.authStatus}</span></td>
      <td>${esc(u.createTime)}</td>
      <td>
        <button class="btn btn-ghost btn-sm" data-action="viewUser" data-id="${u._id}">查看</button>
        <button class="btn btn-primary btn-sm" data-action="authUser" data-id="${u._id}">审核认证</button>
        <button class="btn btn-secondary btn-sm" data-action="toggleUser" data-id="${u._id}" data-status="${u.status}">${u.status === '正常' ? '禁用' : '解禁'}</button>
        <button class="btn btn-ghost btn-sm" data-action="delUser" data-id="${u._id}">删除</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty-tip">暂无数据</td></tr>`

  document.getElementById('content').innerHTML = `
    <div class="filters">
      <select id="u-auth">${opts(['全部', '未认证', '审核中', '已认证', '已驳回'], f.authStatus)}</select>
      <input id="u-kw" placeholder="昵称/学号/姓名" value="${esc(f.keyword)}" />
      <button class="btn btn-primary" id="u-search">筛选</button>
    </div>
    <table class="table"><thead><tr>
      <th>用户ID</th><th>昵称</th><th>学号</th><th>姓名</th><th>认证状态</th><th>注册时间</th><th>操作</th>
    </tr></thead><tbody>${rows}</tbody></table>`

  document.getElementById('u-search').onclick = () => {
    filters.users.authStatus = document.getElementById('u-auth').value
    filters.users.keyword = document.getElementById('u-kw').value.trim()
    renderUsers()
  }
}

/* ---------- 举报处理 ---------- */
async function renderReports() {
  const f = filters.reports
  const list = await API.listReports(f)
  const opts = (arr, sel) => arr.map(o => `<option ${o === sel ? 'selected' : ''}>${o}</option>`).join('')
  const rows = list.map(r => `
    <tr>
      <td>${esc(r._id)}</td>
      <td>${esc(r.reporterId)}</td>
      <td>${esc(r.itemTitle)}</td>
      <td>${esc(r.reason)}</td>
      <td>${esc(r.createTime)}</td>
      <td><span class="tag ${statusClass(r.status)}">${r.status}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" data-action="viewItem" data-id="${r.itemId}">查看</button>
        <button class="btn btn-danger btn-sm" data-action="downReport" data-id="${r._id}">下架信息</button>
        <button class="btn btn-secondary btn-sm" data-action="rejectReport" data-id="${r._id}">驳回举报</button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" class="empty-tip">暂无数据</td></tr>`

  document.getElementById('content').innerHTML = `
    <div class="filters">
      <select id="r-status">${opts(['全部', '待处理', '已处理'], f.status)}</select>
      <button class="btn btn-primary" id="r-search">筛选</button>
    </div>
    <table class="table"><thead><tr>
      <th>举报ID</th><th>举报人</th><th>被举报信息</th><th>举报原因</th><th>时间</th><th>状态</th><th>操作</th>
    </tr></thead><tbody>${rows}</tbody></table>`

  document.getElementById('r-search').onclick = () => {
    filters.reports.status = document.getElementById('r-status').value
    renderReports()
  }
}

/* ---------- 地点管理 ---------- */
async function renderPlaces() {
  const list = await API.listPlaces()
  const items = list.map(p => `
    <div class="place-item">
      <span class="pn">${esc(p.name)}</span>
      <button class="btn btn-ghost btn-sm" data-action="editPlace" data-id="${p._id}" data-name="${esc(p.name)}">编辑</button>
      <button class="btn btn-ghost btn-sm" data-action="delPlace" data-id="${p._id}">删除</button>
    </div>`).join('')
  document.getElementById('content').innerHTML = `
    <div class="filters">
      <button class="btn btn-primary" data-action="addPlace">新增地点</button>
    </div>
    <div class="place-list">${items || '<div class="empty-tip">暂无地点</div>'}</div>`
}

/* ---------- 事件委托 ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]')
  if (!el) return
  const a = el.dataset.action
  const id = el.dataset.id

  if (a === 'viewItem') {
    const it = (window.MOCK.items || []).find(x => x._id === id)
    openModal(`<h3>信息详情</h3><pre style="white-space:pre-wrap;font-size:13px;color:var(--c-text-2)">${esc(JSON.stringify(it, null, 2))}</pre><div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">关闭</button></div>`)
  }
  else if (a === 'viewUser') {
    const u = (window.MOCK.users || []).find(x => x._id === id)
    openModal(`<h3>用户详情</h3><pre style="white-space:pre-wrap;font-size:13px;color:var(--c-text-2)">${esc(JSON.stringify(u, null, 2))}</pre><div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">关闭</button></div>`)
  }
  else if (a === 'passItem') { await API.reviewItem(id, true); closeModal(); renderItems() }
  else if (a === 'downItem') { await API.reviewItem(id, false, '管理员下架'); renderItems() }
  else if (a === 'rejectItem') {
    openModal(`<h3>驳回信息</h3><textarea id="reason" placeholder="请填写驳回原因"></textarea>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-danger" id="doReject">确认驳回</button></div>`)
    document.getElementById('doReject').onclick = async () => {
      await API.reviewItem(id, false, document.getElementById('reason').value)
      renderItems(); closeModal()
    }
  }
  else if (a === 'delItem') { if (confirm('确认删除该信息？')) { await API.deleteItem(id); renderItems() } }

  else if (a === 'authUser') {
    openModal(`<h3>审核认证</h3>
      <button class="btn btn-primary" id="passU" style="margin-right:10px">通过</button>
      <button class="btn btn-danger" id="rejU">驳回</button>
      <textarea id="uReason" placeholder="驳回时填写原因（可选）" style="margin-top:14px"></textarea>
      <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">取消</button></div>`)
    document.getElementById('passU').onclick = async () => { await API.reviewUser(id, true); renderUsers(); closeModal() }
    document.getElementById('rejU').onclick = async () => { await API.reviewUser(id, false, document.getElementById('uReason').value); renderUsers(); closeModal() }
  }
  else if (a === 'toggleUser') { await API.setUserStatus(id, el.dataset.status === '正常' ? '禁用' : '正常'); renderUsers() }
  else if (a === 'delUser') { if (confirm('确认删除该用户？')) { await API.deleteUser(id); renderUsers() } }

  else if (a === 'downReport') { await API.handleReport(id, 'down'); renderReports() }
  else if (a === 'rejectReport') { await API.handleReport(id, 'reject'); renderReports() }

  else if (a === 'addPlace') {
    openModal(`<h3>新增地点</h3><input id="pName" placeholder="地点名称" />
      <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="doAdd">保存</button></div>`)
    document.getElementById('doAdd').onclick = async () => { await API.addPlace(document.getElementById('pName').value); renderPlaces(); closeModal() }
  }
  else if (a === 'editPlace') {
    openModal(`<h3>编辑地点</h3><input id="pName" value="${el.dataset.name}" />
      <div class="modal-actions"><button class="btn btn-secondary" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" id="doEdit">保存</button></div>`)
    document.getElementById('doEdit').onclick = async () => { await API.updatePlace(id, document.getElementById('pName').value); renderPlaces(); closeModal() }
  }
  else if (a === 'delPlace') { if (confirm('确认删除该地点？')) { await API.deletePlace(id); renderPlaces() } }
})

document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal() })

boot()
