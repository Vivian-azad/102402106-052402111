/**
 * 云开发 · 数据清洗云函数（一次性）
 * ------------------------------------------------------------------
 * 作用：
 *   1. 清洗 items.status 脏值：
 *      - 去除首尾空白与不可见字符（\u200b / \ufeff 等）
 *      - 把英文/中文引号包裹的值还原，如 "'已通过'" / "“已通过”" → "已通过"
 *      - 全角字母归一（A→A）
 *      - 无法识别的值统一落到「已通过」并记录原值
 *   2. 归一 items.place 与 places.name：
 *      教学楼A / 教学楼A栋 / 教学楼B栋 / 教A → 教学楼
 *      运动场 / 操场 / 田径场          → 体育馆
 *      宿舍                            → 宿舍区
 *      饭堂 / 一食堂 / 二食堂          → 食堂
 *   3. 清洗 users.authStatus / users.role / users.status 同类脏值
 *   4. 新增 status 为「已完成 / 进行中」的历史记录会保留原值（第 3 步只做格式清洗）
 *
 * 部署与使用：
 *   1. 把本文件放到 cloudfunctions/cleanup/index.js
 *      package.json 内容见同目录 package.json
 *   2. 开发者工具右键 cloudfunctions/cleanup → 上传并部署（云端安装依赖）
 *   3. 在「云函数 → cleanup → 云端测试」里传入：
 *        { "dryRun": true }   ← 先跑一遍，只看报告不改数据（强烈建议）
 *        { "dryRun": false }  ← 确认无误后真正写入
 *   4. 运行结果会返回 changes 明细，可直接对照复查
 *
 *   注意：云函数使用管理员权限，不受集合安全规则限制，能改动所有记录。
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const LIMIT = 100

// —— status 合法枚举 ——
const ITEM_STATUS = ['待审核', '已通过', '已驳回', '已下架', '已完成', '进行中']
const AUTH_STATUS = ['未认证', '审核中', '已认证', '已驳回']
const USER_ROLE   = ['学生', '管理员']
const USER_STATUS = ['正常', '禁用']

// —— 地点归一映射 ——
const PLACE_ALIAS = {
  '教学楼A': '教学楼', '教学楼B': '教学楼', '教学楼C': '教学楼',
  '教学楼A栋': '教学楼', '教学楼B栋': '教学楼', '教学楼C栋': '教学楼',
  '教学楼A座': '教学楼', '教学楼B座': '教学楼',
  '教A': '教学楼', '教B': '教学楼', '教C': '教学楼',
  '运动场': '体育馆', '操场': '体育馆', '田径场': '体育馆', '体育场地': '体育馆',
  '宿舍': '宿舍区',
  '饭堂': '食堂', '一食堂': '食堂', '二食堂': '食堂', '三食堂': '食堂'
}

// —— 类别归一映射 ——
// 合法类别：证件卡类 / 电子产品 / 衣物 / 学习用品 / 生活用品 / 配饰 / 钥匙 / 其他
const CATE_VALID = ['证件卡类', '电子产品', '衣物', '学习用品', '生活用品', '配饰', '钥匙', '其他']
const CATE_ALIAS = {
  '衣物配饰': '衣物', '服饰': '衣物', '衣服': '衣物',
  '电子': '电子产品', '数码': '电子产品',
  '学习': '学习用品', '文具': '学习用品',
  '生活': '生活用品', '日用品': '生活用品',
  '证件': '证件卡类', '卡类': '证件卡类', '卡片': '证件卡类'
}

/**
 * 字符串归一：去掉首尾空白 / 零宽字符，剥掉外层引号，全角转半角
 */
function tidy(s) {
  if (s === null || s === undefined) return ''
  let v = String(s)
  // 零宽字符与 BOM
  v = v.replace(/[\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
  v = v.trim()
  // 反复剥离外层引号（可能包了两层）
  for (let i = 0; i < 3; i++) {
    const m = v.match(/^['"“”‘’`]+(.+?)['"“”‘’`]+$/)
    if (m) v = m[1].trim()
    else break
  }
  // 全角字母数字 → 半角
  v = v.replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  return v.trim()
}

/**
 * 把清洗后的 status 收敛到合法枚举；识别不了的给出兜底
 * @returns {{ value: string, changed: boolean, unknown: boolean }}
 */
function normalizeStatus(raw, validList, fallback) {
  const cleaned = tidy(raw)
  if (validList.indexOf(cleaned) > -1) {
    return { value: cleaned, changed: cleaned !== raw, unknown: false }
  }
  // 尝试模糊修正（如"已通过"里混入空格/"已通 过"）
  const compact = cleaned.replace(/\s/g, '')
  const hit = validList.find(x => x.replace(/\s/g, '') === compact)
  if (hit) return { value: hit, changed: true, unknown: false }
  return { value: fallback, changed: true, unknown: true }
}

function normalizePlace(raw) {
  const cleaned = tidy(raw)
  if (!cleaned) return { value: cleaned, changed: cleaned !== raw, unknown: false }
  let v = cleaned.replace(/[栋幢座]$/, '')
  v = PLACE_ALIAS[v] || PLACE_ALIAS[cleaned] || v
  return { value: v, changed: v !== raw, unknown: false }
}

/**
 * 类别归一：旧名 → 新名，识别不了的落「其他」
 * @returns {{ value: string, changed: boolean, unknown: boolean }}
 */
function normalizeCategory(raw) {
  const cleaned = tidy(raw)
  if (!cleaned) return { value: cleaned, changed: cleaned !== raw, unknown: false }
  if (CATE_VALID.indexOf(cleaned) > -1) {
    return { value: cleaned, changed: cleaned !== raw, unknown: false }
  }
  if (CATE_ALIAS[cleaned]) {
    return { value: CATE_ALIAS[cleaned], changed: true, unknown: false }
  }
  // 宽松：互为子串
  const hit = CATE_VALID.find(k => k.indexOf(cleaned) > -1 || cleaned.indexOf(k) > -1)
  if (hit && cleaned.length >= 2) return { value: hit, changed: true, unknown: false }
  return { value: '其他', changed: true, unknown: true }
}

// 分页拉取集合全部文档
async function fetchAll(collName) {
  const all = []
  const cnt = (await db.collection(collName).count()).total
  const pages = Math.ceil(cnt / LIMIT)
  for (let p = 0; p < pages; p++) {
    const r = await db.collection(collName).skip(p * LIMIT).limit(LIMIT).get()
    all.push(...r.data)
  }
  return all
}

// 按字段批量写入（云函数中 db 操作需串行以避免并发限制）
async function patchDoc(collName, id, data) {
  if (!Object.keys(data).length) return
  await db.collection(collName).doc(id).update({ data })
}

exports.main = async (event) => {
  const dryRun = event && event.dryRun !== false   // 默认 dryRun，必须显式传 false 才写入
  const report = {
    dryRun,
    items: { scanned: 0, statusFixed: 0, placeFixed: 0, cateFixed: 0, unknownStatus: [], unknownCate: [] },
    users: { scanned: 0, fixed: 0 },
    places: { scanned: 0, fixed: 0 },
    samples: []
  }

  /* ---------------- items ---------------- */
  const items = await fetchAll('items')
  report.items.scanned = items.length
  for (const it of items) {
    const patch = {}

    const st = normalizeStatus(it.status, ITEM_STATUS, '已通过')
    if (st.changed) {
      patch.status = st.value
      report.items.statusFixed++
      if (st.unknown) report.items.unknownStatus.push({ _id: it._id, title: it.title, raw: it.status })
      if (report.samples.length < 10) {
        report.samples.push({ coll: 'items', _id: it._id, field: 'status', from: it.status, to: st.value })
      }
    }

    const pl = normalizePlace(it.place)
    if (pl.changed) {
      patch.place = pl.value
      report.items.placeFixed++
      if (report.samples.length < 10) {
        report.samples.push({ coll: 'items', _id: it._id, field: 'place', from: it.place, to: pl.value })
      }
    }

    const cg = normalizeCategory(it.category)
    if (cg.changed) {
      patch.category = cg.value
      report.items.cateFixed++
      if (cg.unknown) report.items.unknownCate.push({ _id: it._id, title: it.title, raw: it.category })
      if (report.samples.length < 10) {
        report.samples.push({ coll: 'items', _id: it._id, field: 'category', from: it.category, to: cg.value })
      }
    }

    if (!dryRun) await patchDoc('items', it._id, patch)
  }

  /* ---------------- users ---------------- */
  const users = await fetchAll('users')
  report.users.scanned = users.length
  for (const u of users) {
    const patch = {}
    const a = normalizeStatus(u.authStatus, AUTH_STATUS, '未认证')
    if (a.changed) patch.authStatus = a.value
    const rol = normalizeStatus(u.role, USER_ROLE, '学生')
    if (rol.changed) patch.role = rol.value
    const ust = normalizeStatus(u.status, USER_STATUS, '正常')
    if (ust.changed) patch.status = ust.value
    if (Object.keys(patch).length) report.users.fixed++
    if (!dryRun) await patchDoc('users', u._id, patch)
  }

  /* ---------------- places ---------------- */
  const places = await fetchAll('places')
  report.places.scanned = places.length
  const seenPlace = new Set()
  for (const p of places) {
    const nm = normalizePlace(p.name)
    if (nm.changed) {
      // 若归一后已存在同名地点，则删除重复项
      if (seenPlace.has(nm.value)) {
        if (!dryRun) await db.collection('places').doc(p._id).remove()
        report.places.fixed++
        continue
      }
      if (!dryRun) await patchDoc('places', p._id, { name: nm.value })
      report.places.fixed++
    }
    seenPlace.add(nm.value)
  }

  return report
}
