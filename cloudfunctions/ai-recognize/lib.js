/**
 * AI 识别 · 纯逻辑层（不依赖 wx-server-sdk，便于本地单测）
 * ------------------------------------------------------------------
 * 只做三件事：
 *   1. 生成给视觉大模型的 Prompt
 *   2. 从模型输出里稳健地抠出 JSON
 *   3. 把模型给的类别映射回小程序内的类别白名单
 */

/* ---------------- 类别白名单与同义词 ---------------- */

// 与 miniprogram/utils/category.js 的 CATE_LIST 保持一致
const CATE_LIST = ['证件卡类', '电子产品', '衣物', '学习用品', '生活用品', '配饰', '钥匙', '其他']

// 模型可能给出各种口语化称呼，这里收敛到白名单
// 顺序即优先级：先精确命中，再按关键词包含命中
const CATE_SYNONYM = [
  ['证件卡类', ['证件卡', '校园卡', '一卡通', '学生证', '身份证', '银行卡', '饭卡', '借书证', '门禁卡', '公交卡', '社保卡', '会员卡', '证件', '卡片', '卡类']],
  ['电子产品', ['手机', '耳机', '充电宝', '移动电源', '电脑', '笔记本电', '平板', 'ipad', '键盘', '鼠标', '相机', '手环', '智能手表', '手表', '计算器', 'u盘', '优盘', '数据线', '充电器', '充电头', '音箱', '音响', '电子']],
  ['钥匙', ['钥匙', '钥匙串', '车钥匙', '门钥匙']],
  ['配饰', ['眼镜', '墨镜', '首饰', '项链', '手链', '耳环', '耳钉', '戒指', '发卡', '发夹', '帽子', '腰带', '皮带', '围巾']],
  ['衣物', ['衣服', '外套', '上衣', '裤子', '裙子', '卫衣', '校服', '棒球服', '羽绒服', '大衣', 't恤', '衬衫', '手套', '袜子', '鞋', '服']],
  ['学习用品', ['书', '课本', '教材', '笔记', '笔', '文具', '书包', '尺子', '橡皮', '文件夹', '作业', '画板', '计算器']],
  ['生活用品', ['水杯', '保温杯', '杯子', '水壶', '雨伞', '伞', '背包', '双肩包', '包', '饭盒', '毛巾', '梳子', '镜子', '玩具', '日用品', '生活']]
]

function tidy(v) {
  if (v === null || v === undefined) return ''
  return String(v)
    .replace(/[​-‏‪-‮﻿]/g, '')       // 零宽字符
    .replace(/^[ '"“”‘’`]+|[ '"“”‘’`]+$/g, '')   // 外层引号
    .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角转半角
    .trim()
}

/**
 * 把模型的类别输出归一到白名单
 * @param {string} raw 模型给出的类别
 * @returns {string} 白名单内的类别，无法判断时返回「其他」
 */
function normalizeCategory(raw) {
  const c = tidy(raw)
  if (!c) return '其他'

  const low = c.toLowerCase()

  // 1) 精确命中白名单
  if (CATE_LIST.indexOf(c) > -1) return c

  // 2) 关键词命中（按上面的优先级顺序）
  for (let i = 0; i < CATE_SYNONYM.length; i++) {
    const target = CATE_SYNONYM[i][0]
    const words = CATE_SYNONYM[i][1]
    for (let j = 0; j < words.length; j++) {
      if (low.indexOf(words[j]) > -1) return target
    }
  }
  return '其他'
}

/* ---------------- Prompt ---------------- */

function buildPrompt(typeHint) {
  const hint = typeHint === '招领' ? '这是一张拾到物品的照片' : '这是一张丢失物品的照片'
  return [
    hint + '。请识别照片中的主体物品，用于校园失物招领。',
    '只输出一个 JSON 对象，不要输出任何解释文字、不要加 markdown 代码块，格式如下：',
    '{"title":"物品名称，10字以内，含颜色+材质/品牌等可辨识特征","desc":"外观描述，30-60字，说明颜色、材质、尺寸、明显磨损或标记","category":"从 [证件卡类, 电子产品, 衣物, 学习用品, 生活用品, 配饰, 钥匙, 其他] 中选一个最贴近的"}',
    '如果照片模糊或看不清主体，则把 title 设为「无法辨认」，desc 说明原因。'
  ].join('\n')
}

/* ---------------- JSON 提取 ---------------- */

/**
 * 从模型输出中抠出 JSON 对象
 * 兼容：```json 围栏、前后废话、中文引号、尾部逗号
 * @param {string} text 模型原始输出
 * @returns {object|null}
 */
function extractJson(text) {
  if (!text) return null
  let s = String(text).trim()

  // 去掉 markdown 围栏
  s = s.replace(/^```(?:json|JSON)?\s*/, '').replace(/```\s*$/, '').trim()

  // 找第一个 { 开始的完整对象（跟踪字符串与转义，避免内容里的括号干扰）
  let start = -1, depth = 0, inStr = false, esc = false
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') { if (depth === 0) start = i; depth++; continue }
    if (ch === '}') { depth--; if (depth === 0 && start > -1) { s = s.slice(start, i + 1); break } continue }
  }
  if (start === -1) return null

  const tries = [
    s,
    s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"),   // 中文引号
    s.replace(/,\s*([}\]])/g, '$1')                   // 尾部逗号
  ]
  for (let i = 0; i < tries.length; i++) {
    try {
      const obj = JSON.parse(tries[i])
      if (obj && typeof obj === 'object') return obj
    } catch (e) { /* 继续尝试下一种修复 */ }
  }
  return null
}

/**
 * 把模型 JSON 整理成小程序要的字段
 * @param {object} obj
 * @returns {{title:string, desc:string, category:string}}
 */
function pickFields(obj) {
  const o = obj || {}
  const first = (...keys) => {
    for (const k of keys) {
      if (o[k] !== undefined && o[k] !== null && String(o[k]).trim() !== '') return String(o[k]).trim()
    }
    return ''
  }
  const title = tidy(first('title', 'name', '物品名称', '名称', 'item'))
  const desc = tidy(first('desc', 'description', 'detail', '描述', '外观'))
  return { title, desc, category: normalizeCategory(first('category', 'type', '类别', '分类')) }
}

module.exports = {
  CATE_LIST,
  CATE_SYNONYM,
  tidy,
  buildPrompt,
  normalizeCategory,
  extractJson,
  pickFields
}
