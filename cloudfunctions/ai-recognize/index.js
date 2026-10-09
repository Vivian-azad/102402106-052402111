/**
 * 云开发 · AI 物品识别云函数
 * ------------------------------------------------------------------
 * 作用：传入一张照片的云存储 fileID，调用云开发 AI 视觉大模型识别物品，
 *      返回 { title, desc, category } 供发布页自动填充。
 *
 * ===== 部署步骤（缺一步就跑不起来） =====
 * 1. 云开发控制台 → 开通「AI 能力 / 大模型」（新环境通常需手动打开模型开关）
 * 2. 把 cloudfunctions/ai-recognize 整个目录放进工程
 * 3. 右键 ai-recognize →「上传并部署：云端安装依赖」
 *    （本云函数依赖 wx-server-sdk ≥ 4.0.1，cloud.ai() 从该版本开始提供）
 * 4. 云函数 → ai-recognize → 云端测试：
 *      { "probe": true }                  ← 只查环境是否就绪，不消耗额度
 *      { "fileID": "cloud://xxx.png" }    ← 真识别
 *
 * ===== 返回约定（前端按 code 提示） =====
 * { ok:true,  data:{title,desc,category}, model }
 * { ok:false, code:'AI_NOT_ENABLED' }   云开发 AI 未开通 / SDK 版本过低
 * { ok:false, code:'NO_FILEID' }        没传 fileID
 * { ok:false, code:'DOWNLOAD_FAIL' }    云存储下载失败
 * { ok:false, code:'IMAGE_TOO_LARGE' }  图片超过 4MB
 * { ok:false, code:'PARSE_FAIL', raw }  模型有返回但解析不出 JSON
 * { ok:false, code:'AI_ERROR', message, attempts }  调用失败（含每次尝试的信息）
 */
const cloud = require('wx-server-sdk')
const lib = require('./lib.js')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV, timeout: 60000 })

// 候选模型：按序尝试，第一个能正确识别的即为结果
// hunyuan-exp 是官方免费体验模型；hy3-preview 为混元新版，视觉能力更全
const MODELS = ['hunyuan-exp', 'hy3-preview']
const MAX_BYTES = 4 * 1024 * 1024    // 图片上限
const CALL_TIMEOUT = 20000           // 单次模型调用超时
const TOTAL_BUDGET = 45000           // 总重试预算，留 15s 给下载与返回

/** 取出模型返回里的文本（兼容不同 SDK 版本的返回结构） */
function textOf(result) {
  if (!result) return ''
  if (typeof result === 'string') return result
  if (typeof result.text === 'string') return result.text
  if (result.data && typeof result.data.text === 'string') return result.data.text
  if (Array.isArray(result.choices) && result.choices[0]) {
    const c = result.choices[0]
    if (typeof c === 'string') return c
    const m = c.message
    if (Array.isArray(m)) return m.map(x => (typeof x === 'string' ? x : (x && x.text) || '')).join('')
    if (m && typeof m === 'object') {
      const content = m.content
      if (typeof content === 'string') return content
      if (Array.isArray(content)) return content.map(x => (typeof x === 'string' ? x : (x && x.text) || '')).join('')
    }
    if (typeof c.text === 'string') return c.text
  }
  if (typeof result.content === 'string') return result.content
  if (Array.isArray(result.content)) return result.content.map(x => (typeof x === 'string' ? x : (x && x.text) || '')).join('')
  return ''
}

/** 兼容不同 SDK 版本的 AI 入口 */
function getAI() {
  if (typeof cloud.ai === 'function') {
    try { const ai = cloud.ai(); if (ai && ai.createModel) return ai } catch (e) {}
  }
  if (cloud.extend && cloud.extend.AI && cloud.extend.AI.createModel) return cloud.extend.AI
  if (typeof cloud.getAI === 'function') {
    try { const ai = cloud.getAI(); if (ai && ai.createModel) return ai } catch (e) {}
  }
  return null
}

/** 两种图片输入格式：OpenAI 兼容的 image_url(dataURI) 与混元 SDK 的 image_base64 */
function buildContent(prompt, base64) {
  return {
    openai: [
      { type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + base64 } }
    ],
    hunyuan: [
      { type: 'text', text: prompt },
      { type: 'image', image_base64: base64 }
    ]
  }
}

exports.main = async (event) => {
  const ev = event || {}

  /* ---- 自检：只看环境是否就绪，不调模型 ---- */
  if (ev.probe) {
    const ai = getAI()
    return {
      ok: !!ai,
      code: ai ? 'READY' : 'AI_NOT_ENABLED',
      entry: ai ? 'available' : 'none',
      models: MODELS,
      categories: lib.CATE_LIST
    }
  }

  const fileID = ev.fileID || (ev.file && ev.file.fileID)
  if (!fileID) return { ok: false, code: 'NO_FILEID' }

  const ai = getAI()
  if (!ai) {
    return {
      ok: false,
      code: 'AI_NOT_ENABLED',
      message: '未获取到 AI 能力：请在云开发控制台开通 AI，并确认 wx-server-sdk ≥ 4.0.1'
    }
  }

  /* ---- 1. 下载图片 ---- */
  let buffer
  try {
    const res = await cloud.downloadFile({ fileID })
    buffer = res.fileContent
  } catch (err) {
    return { ok: false, code: 'DOWNLOAD_FAIL', message: String((err && err.message) || err) }
  }
  if (!buffer || !buffer.length) return { ok: false, code: 'DOWNLOAD_FAIL', message: '图片内容为空' }
  if (buffer.length > MAX_BYTES) {
    return { ok: false, code: 'IMAGE_TOO_LARGE', message: '图片超过 4MB，请先压缩', size: buffer.length }
  }

  /* ---- 2. 依次尝试「模型 × 图片格式」 ---- */
  const base64 = buffer.toString('base64')
  const prompt = lib.buildPrompt(ev.type)
  const models = ev.model ? [ev.model] : MODELS
  const attempts = []
  const t0 = Date.now()
  let lastRaw = ''

  for (let i = 0; i < models.length; i++) {
    const modelName = models[i]
    let model
    try {
      model = ai.createModel(modelName)
    } catch (e) {
      attempts.push({ model: modelName, fmt: '-', error: String((e && e.message) || e) })
      continue
    }

    const contents = buildContent(prompt, base64)
    const fmts = ['openai', 'hunyuan']
    for (let j = 0; j < fmts.length; j++) {
      if (Date.now() - t0 > TOTAL_BUDGET) break
      const fmt = fmts[j]
      let raw = ''
      try {
        const result = await model.generateText({
          model: modelName,
          timeout: CALL_TIMEOUT,
          messages: [{ role: 'user', content: contents[fmt] }]
        })
        raw = textOf(result)
        lastRaw = raw
      } catch (err) {
        attempts.push({ model: modelName, fmt, error: String((err && err.message) || err) })
        continue
      }

      const obj = lib.extractJson(raw)
      if (!obj) {
        attempts.push({ model: modelName, fmt, error: 'PARSE_FAIL', raw: String(raw).slice(0, 200) })
        continue
      }
      const data = lib.pickFields(obj)
      if (!data.title) {
        attempts.push({ model: modelName, fmt, error: 'EMPTY_TITLE', raw: String(raw).slice(0, 200) })
        continue
      }
      return { ok: true, data, model: modelName, fmt, raw: String(raw).slice(0, 500), attempts }
    }
  }

  return {
    ok: false,
    code: lastRaw ? 'PARSE_FAIL' : 'AI_ERROR',
    message: lastRaw ? '模型返回内容无法解析' : '全部模型调用失败，请查看 attempts',
    raw: String(lastRaw).slice(0, 500),
    attempts
  }
}
