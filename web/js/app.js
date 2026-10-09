/**
 * app.js —— 前端路由 + 视图渲染
 * 采用 hash 路由的单页应用（SPA），无构建、无框架，纯原生 JS。
 * 视图：home（首页）/ search（搜索）/ detail（详情）/ publish（发布）/ mine（我的发布）
 */
(function () {
  const C = window.Core
  const S = window.Store

  const view = document.getElementById('view')
  const toastEl = document.getElementById('toast')
  let toastTimer = null

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  }

  function toast(msg) {
    toastEl.textContent = msg
    toastEl.classList.remove('hidden')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2000)
  }

  // 关键词高亮
  function hl(text, kw) {
    const safe = esc(text)
    if (!kw) return safe
    const k = esc(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    try {
      return safe.replace(new RegExp('(' + k + ')', 'gi'), '<span style="color:var(--purple);font-weight:700">$1</span>')
    } catch (e) { return safe }
  }

  function typeTag(t) {
    return t === '招领'
      ? '<span class="tag tag-found"><span class="dot"></span>招领</span>'
      : '<span class="tag tag-lost"><span class="dot"></span>寻物</span>'
  }

  function statusTag(s) {
    if (s === '已找到' || s === '已归还') return '<span class="tag tag-done"><span class="dot"></span>' + esc(s) + '</span>'
    if (s === '进行中') return '<span class="tag tag-wait"><span class="dot"></span>进行中</span>'
    return '<span class="tag tag-gray"><span class="dot"></span>' + esc(s) + '</span>'
  }

  function fmtDate(v) {
    if (!v) return ''
    const m = String(v).replace('T', ' ').match(/^(\d{4})-(\d{2})-(\d{2})([ ]?(\d{2}:\d{2}))?/)
    if (m) return Number(m[2]) + '月' + Number(m[3]) + '日' + (m[5] ? ' ' + m[5] : '')
    return String(v)
  }

  /* ---------------- 卡片渲染 ---------------- */
  function itemCard(it, kw) {
    const emoji = C.categoryEmoji(it.category, it.type)
    return `
      <div class="item-card type-${esc(it.type)}" data-id="${esc(it._id)}">
        <div class="item-card-top">
          <div class="item-emoji">${emoji}</div>
          <div class="item-card-title">${hl(it.title, kw)}</div>
        </div>
        <div class="item-card-meta">
          ${typeTag(it.type)}
          <span class="tag tag-gray"><span class="dot"></span>${esc(it.place || '未知地点')}</span>
        </div>
        <div class="item-card-foot">
          <span>📍 ${esc(it.place || '未知')}</span>
          <span>${fmtDate(it.createTime)}</span>
        </div>
      </div>`
  }

  function emptyState(emoji, txt, btnTxt, href) {
    return `
      <div class="empty-state">
        <div class="empty-emoji">${emoji}</div>
        <div class="empty-txt">${esc(txt)}</div>
        ${btnTxt ? `<a class="btn btn-primary" href="${href}">${esc(btnTxt)}</a>` : ''}
      </div>`
  }

  /* ============================================================
   * 视图：首页
   * ============================================================ */
  function renderHome() {
    const tabs = ['全部', '寻物', '招领']
    const list = S.listItems({ status: C.STATUS.ACTIVE })
    view.innerHTML = `
      <div class="searchbar">
        <input id="homeSearch" type="text" placeholder="搜索物品名称、地点…" />
        <button class="btn btn-primary" id="homeSearchBtn">搜索</button>
      </div>
      <div class="sec-head">
        <span class="sec-title">最近信息</span>
        <a href="#/search" style="font-size:13px;color:var(--text-mute)">查看全部 ›</a>
      </div>
      <div class="segment" id="homeTabs">
        ${tabs.map((t, i) => `<div class="seg-item ${i === 0 ? 'on' : ''}" data-i="${i}">${t}</div>`).join('')}
      </div>
      <div id="homeFeed" class="feed"></div>`

    const feed = document.getElementById('homeFeed')

    function refresh(type) {
      const q = { status: C.STATUS.ACTIVE }
      if (type) q.type = type
      const items = S.listItems(q)
      feed.innerHTML = items.length
        ? items.map(it => itemCard(it, '')).join('')
        : emptyState('🔍', '暂无相关信息，快去发布吧', '去发布', '#/publish')
    }

    document.getElementById('homeTabs').addEventListener('click', e => {
      const seg = e.target.closest('.seg-item')
      if (!seg) return
      document.querySelectorAll('#homeTabs .seg-item').forEach(x => x.classList.remove('on'))
      seg.classList.add('on')
      const i = Number(seg.dataset.i)
      refresh(i === 0 ? '' : tabs[i])
    })

    document.getElementById('homeSearchBtn').addEventListener('click', () => {
      const kw = document.getElementById('homeSearch').value.trim()
      location.hash = '#/search' + (kw ? '?kw=' + encodeURIComponent(kw) : '')
    })
    document.getElementById('homeSearch').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('homeSearchBtn').click()
    })

    refresh('')
  }

  /* ============================================================
   * 视图：搜索
   * ============================================================ */
  function renderSearch(params) {
    const types = ['全部', '寻物', '招领']
    const times = ['全部', '今天', '近三天', '近一周']
    const timeMap = { '今天': 'today', '近三天': '3d', '近一周': '7d' }
    const places = ['全部'].concat(C.PLACE_LIST)

    let kw = params.kw || ''
    let typeIdx = 0, placeIdx = 0, timeIdx = 0

    view.innerHTML = `
      <div class="searchbar">
        <input id="sKw" type="text" placeholder="搜索物品名称、描述…" value="${esc(kw)}" />
        <button class="btn btn-primary" id="sBtn">搜索</button>
      </div>
      <div class="filter-row">
        <select id="sType" class="form-select">${types.map((t, i) => `<option value="${i}">${t}</option>`).join('')}</select>
        <select id="sPlace" class="form-select">${places.map((p, i) => `<option value="${i}">${p}</option>`).join('')}</select>
        <select id="sTime" class="form-select">${times.map((t, i) => `<option value="${i}">${t}</option>`).join('')}</select>
      </div>
      <div id="sResult" class="feed"></div>`

    function doSearch() {
      const q = { status: C.STATUS.ACTIVE }
      typeIdx = Number(document.getElementById('sType').value)
      placeIdx = Number(document.getElementById('sPlace').value)
      timeIdx = Number(document.getElementById('sTime').value)
      kw = document.getElementById('sKw').value.trim()
      if (typeIdx > 0) q.type = types[typeIdx]
      if (placeIdx > 0) q.place = places[placeIdx]
      if (timeIdx > 0) q.timeRange = timeMap[times[timeIdx]]
      if (kw) q.keyword = kw

      const items = S.listItems(q)
      document.getElementById('sResult').innerHTML = items.length
        ? items.map(it => itemCard(it, kw)).join('')
        : emptyState('😕', '没有找到匹配的信息', '清空条件', '#/search')
    }

    document.getElementById('sBtn').addEventListener('click', doSearch)
    document.getElementById('sKw').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch() })
    document.getElementById('sType').addEventListener('change', doSearch)
    document.getElementById('sPlace').addEventListener('change', doSearch)
    document.getElementById('sTime').addEventListener('change', doSearch)

    doSearch()
  }

  /* ============================================================
   * 视图：详情
   * ============================================================ */
  function renderDetail(id) {
    const it = S.getItem(id)
    if (!it) {
      view.innerHTML = emptyState('😕', '信息不存在或已删除', '返回首页', '#/home')
      return
    }
    const me = S.getMe()
    const isPublisher = it.publisherId === me._id
    const isDone = it.status !== C.STATUS.ACTIVE
    const emoji = C.categoryEmoji(it.category, it.type)
    const terminal = C.terminalStatus(it.type)

    view.innerHTML = `
      <div class="detail-card">
        <div class="detail-hero type-${esc(it.type)}">${emoji}</div>
        <div class="detail-body">
          <div class="detail-title">${esc(it.title)} ${typeTag(it.type)}</div>

          ${isDone
            ? `<div class="status-banner done">✅ 该信息已${esc(it.status)}，感谢关注</div>`
            : `<div class="status-banner active">⏳ 该信息仍在${esc(it.status)}，可联系发布者</div>`}

          <div class="detail-row">
            <div class="detail-label">物品类别</div>
            <div class="detail-value">${esc(it.category || '其他')}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">${it.type === '招领' ? '拾取地点' : '遗失地点'}</div>
            <div class="detail-value">📍 ${esc(it.place || '未知')}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">时间</div>
            <div class="detail-value">${esc(it.time || '')}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">详细描述</div>
            <div class="detail-value">${esc(it.description || '（无描述）')}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">发布者</div>
            <div class="detail-value">${esc(it.publisherName)}</div>
          </div>
          <div class="detail-row">
            <div class="detail-label">联系方式</div>
            <div class="detail-value"><span class="contact">${esc(it.contact)}</span></div>
          </div>
          <div class="detail-row">
            <div class="detail-label">发布时间</div>
            <div class="detail-value">${esc(it.createTime)}</div>
          </div>

          <div class="detail-actions">
            <button class="btn btn-mint" id="copyBtn">📋 一键复制联系方式</button>
            ${isPublisher && !isDone ? `<button class="btn btn-primary" id="doneBtn">✅ 标记为「${esc(terminal)}」</button>` : ''}
            ${isPublisher ? `<a class="btn btn-ghost" href="#/mine">我的发布</a>` : ''}
            <a class="btn btn-plain" href="#/home">返回</a>
          </div>
        </div>
      </div>`

    // 一键复制联系方式（附加特点）
    document.getElementById('copyBtn').addEventListener('click', () => {
      const done = () => toast('已复制联系方式：' + it.contact)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(it.contact).then(done).catch(() => { fallbackCopy(it.contact); done() })
      } else {
        fallbackCopy(it.contact); done()
      }
    })

    // 发布者标记终态（状态流转闭环）
    if (isPublisher && !isDone) {
      document.getElementById('doneBtn').addEventListener('click', () => {
        if (confirm('确认将该信息标记为「' + terminal + '」？标记后它将不再出现在公共列表。')) {
          const r = S.updateItemStatus(id, terminal)
          if (r.ok) { toast('状态已更新'); renderDetail(id) }
          else toast(r.error || '更新失败')
        }
      })
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch (e) {}
    document.body.removeChild(ta)
  }

  /* ============================================================
   * 视图：发布
   * ============================================================ */
  function renderPublish(editId) {
    const editing = editId ? S.getItem(editId) : null
    const me = S.getMe()

    view.innerHTML = `
      <div class="sec-head"><span class="sec-title">${editing ? '编辑信息' : '发布信息'}</span></div>
      <div class="form-card">
        <div class="form-row">
          <div class="form-label">信息类型 <span class="req">*</span></div>
          <div class="seg-radio" id="pType">
            <label data-v="寻物" class="${!editing || editing.type === '寻物' ? 'on' : ''}">🔍 寻物<input type="radio" name="type" value="寻物" ${!editing || editing.type === '寻物' ? 'checked' : ''}></label>
            <label data-v="招领" class="${editing && editing.type === '招领' ? 'on' : ''}">📦 招领<input type="radio" name="type" value="招领" ${editing && editing.type === '招领' ? 'checked' : ''}></label>
          </div>
        </div>
        <div class="form-row">
          <div class="form-label">物品名称 <span class="req">*</span></div>
          <input id="pTitle" class="form-input" placeholder="如：校园卡、蓝牙耳机…" value="${esc(editing ? editing.title : '')}" maxlength="30" />
        </div>
        <div class="form-row">
          <div class="form-label">物品类别</div>
          <select id="pCategory" class="form-select">
            ${C.CATEGORY_LIST.map(c => `<option ${editing && editing.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">地点 <span class="req">*</span></div>
          <select id="pPlace" class="form-select">
            <option value="">请选择地点</option>
            ${C.PLACE_LIST.map(p => `<option ${editing && editing.place === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">联系方式 <span class="req">*</span></div>
          <input id="pContact" class="form-input" placeholder="手机号 / 微信号" value="${esc(editing ? editing.contact : (me.phone || ''))}" />
          <div class="form-hint">拾取者/失主可通过该方式联系你</div>
        </div>
        <div class="form-row">
          <div class="form-label">详细描述</div>
          <textarea id="pDesc" class="form-textarea" placeholder="描述物品外观、特征、丢失/拾取的具体情况…" maxlength="200">${esc(editing ? editing.description : '')}</textarea>
        </div>
        <div id="pError" class="form-error"></div>
        <button class="btn btn-primary btn-block" id="pSubmit" style="margin-top:8px">${editing ? '保存修改' : '发布'}</button>
      </div>`

    // 类型切换
    document.getElementById('pType').addEventListener('click', e => {
      const label = e.target.closest('label')
      if (!label) return
      document.querySelectorAll('#pType label').forEach(x => x.classList.remove('on'))
      label.classList.add('on')
      label.querySelector('input').checked = true
    })

    document.getElementById('pSubmit').addEventListener('click', () => {
      const type = document.querySelector('#pType input:checked').value
      const data = {
        type,
        title: document.getElementById('pTitle').value,
        category: document.getElementById('pCategory').value,
        place: document.getElementById('pPlace').value,
        contact: document.getElementById('pContact').value,
        description: document.getElementById('pDesc').value
      }

      const check = C.validatePublish(data)
      if (!check.ok) {
        document.getElementById('pError').textContent = check.errors[0]
        toast(check.errors[0])
        return
      }
      document.getElementById('pError').textContent = ''

      const r = editing ? S.updateItem(editId, data) : S.createItem(data)
      if (r.ok) {
        toast(editing ? '已保存' : '发布成功')
        location.hash = editing ? '#/mine' : '#/detail/' + r.item._id
      } else {
        document.getElementById('pError').textContent = (r.errors && r.errors[0]) || r.error || '操作失败'
        toast((r.errors && r.errors[0]) || r.error || '操作失败')
      }
    })
  }

  /* ============================================================
   * 视图：我的发布
   * ============================================================ */
  function renderMine() {
    const list = S.listMyItems()
    view.innerHTML = `
      <div class="sec-head">
        <span class="sec-title">我的发布</span>
        <a class="btn btn-primary btn-sm" href="#/publish">+ 发布新信息</a>
      </div>
      <div id="mineList"></div>`

    const box = document.getElementById('mineList')

    function render() {
      const items = S.listMyItems()
      if (!items.length) {
        box.innerHTML = emptyState('📭', '你还没有发布过信息', '去发布', '#/publish')
        return
      }
      box.innerHTML = items.map(it => `
        <div class="item-card" data-id="${esc(it._id)}" style="cursor:default">
          <div class="item-card-top">
            <div class="item-emoji">${C.categoryEmoji(it.category, it.type)}</div>
            <div class="item-card-title">${esc(it.title)}</div>
          </div>
          <div class="item-card-meta">
            ${typeTag(it.type)}${statusTag(it.status)}
          </div>
          <div class="item-card-foot">
            <span>📍 ${esc(it.place || '未知')}</span>
            <span>${fmtDate(it.createTime)}</span>
          </div>
          <div class="detail-actions" style="margin-top:8px">
            <a class="btn btn-ghost btn-sm" href="#/detail/${esc(it._id)}">查看</a>
            ${it.status === C.STATUS.ACTIVE ? `<a class="btn btn-plain btn-sm" href="#/publish/${esc(it._id)}">编辑</a>` : ''}
            ${it.status === C.STATUS.ACTIVE ? `<button class="btn btn-mint btn-sm" data-done="${esc(it._id)}" data-term="${esc(C.terminalStatus(it.type))}">标记已${esc(C.terminalStatus(it.type))}</button>` : ''}
            <button class="btn btn-danger btn-sm" data-del="${esc(it._id)}">删除</button>
          </div>
        </div>`).join('')
    }

    box.addEventListener('click', e => {
      const doneBtn = e.target.closest('[data-done]')
      const delBtn = e.target.closest('[data-del]')
      if (doneBtn) {
        const term = doneBtn.dataset.term
        if (confirm('确认标记为「' + term + '」？')) {
          const r = S.updateItemStatus(doneBtn.dataset.done, term)
          if (r.ok) { toast('状态已更新'); render() }
          else toast(r.error || '更新失败')
        }
      } else if (delBtn) {
        if (confirm('确认删除该信息？删除后无法恢复。')) {
          const r = S.removeItem(delBtn.dataset.del)
          if (r.ok) { toast('已删除'); render() }
          else toast(r.error || '删除失败')
        }
      }
    })

    render()
  }

  /* ============================================================
   * 路由
   * ============================================================ */
  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '') || 'home'
    const [pathPart, queryPart] = h.split('?')
    const segs = pathPart.split('/').filter(Boolean)
    const params = {}
    if (queryPart) {
      queryPart.split('&').forEach(kv => {
        const [k, v] = kv.split('=')
        params[decodeURIComponent(k)] = decodeURIComponent(v || '')
      })
    }
    return { segs, params }
  }

  function router() {
    const { segs, params } = parseHash()
    const route = segs[0] || 'home'
    const id = segs[1]

    // 高亮导航
    document.querySelectorAll('.nav-link').forEach(a => {
      a.classList.toggle('active', a.dataset.route === route)
    })

    switch (route) {
      case 'home': renderHome(); break
      case 'search': renderSearch(params); break
      case 'detail': renderDetail(id); break
      case 'publish': renderPublish(id); break
      case 'mine': renderMine(); break
      default: renderHome()
    }
    window.scrollTo(0, 0)
  }

  // 事件委托：卡片点击 → 详情
  view.addEventListener('click', e => {
    const card = e.target.closest('.item-card[data-id]')
    if (card && !e.target.closest('a') && !e.target.closest('button') && !e.target.closest('.detail-actions')) {
      location.hash = '#/detail/' + card.dataset.id
    }
  })

  window.addEventListener('hashchange', router)
  router()
})()
