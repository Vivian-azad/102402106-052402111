const api = require('../../utils/api')
const icons = require('../../utils/icons')
const util = require('../../utils/util')
const cate = require('../../utils/category')
const aiParse = require('../../utils/ai-parse')

Page({
  data: {
    // 0=寻物 1=招领
    typeIndex: 0,
    title: '',
    desc: '',
    place: '',
    date: '',
    category: '',
    contact: '',
    images: [],
    certified: true,
    submitting: false,

    // AI 相机演示
    aiScanning: false,
    aiDone: false,
    aiResult: '',

    // 图标
    icoBack: '',
    icoCamera: '',
    icoChevron: '',
    icoTag: '',
    icoDoc: '',
    icoPin: '',
    icoDate: '',
    icoGrid: '',
    icoImage: '',
    icoPlus: '',

    // 编辑模式（从“我的发布 → 编辑”进入时携带 _id）
    editId: '',
    isEdit: false,

    mascot: '/assets/images/mascot-bunny.png',
    robot: '/assets/images/robot-assist.png',
    placeIndex: -1,
    cateIndex: -1,

    placeList: ['图书馆', '食堂', '教学楼', '宿舍区', '体育馆', '晋江楼', '其他'],
    cateList: cate.CATE_LIST
  },

  onLoad(opt) {
    this.setData({
      icoBack:    icons.icon('arrow',  '#3A3752', 26, { extra: '<g></g>' }),
      icoCamera:  icons.icon('camera', '#8B6FE8', 46),
      icoChevron: icons.icon('arrow',  '#FFFFFF', 30),
      icoTag:     icons.icon('tag',    '#8B6FE8', 34),
      icoDoc:     icons.icon('doc',    '#8B6FE8', 34),
      icoPin:     icons.icon('map',    '#8B6FE8', 34),
      icoDate:    icons.icon('date',   '#8B6FE8', 34),
      icoGrid:    icons.icon('grid',   '#8B6FE8', 34),
      icoImage:   icons.icon('image',  '#8B6FE8', 34),
      icoPlus:    icons.icon('plus',   '#6E6B85', 36)
    })
    this.checkAuth()

    // 兼容：若以带参方式进入（非 tabBar 场景）也支持
    const id = opt && opt.id
    if (id) {
      this.setData({ editId: id, isEdit: true })
      this.loadForEdit(id)
    }
  },

  // —— 载入待编辑的信息并预填表单 ——
  loadForEdit(id) {
    // 同时取「信息」和「当前用户」，避免 this.me 尚未就绪导致误判非本人
    Promise.all([api.getItem(id), api.getMe()]).then(([item, m]) => {
      if (!item) {
        wx.showToast({ title: '信息不存在或已删除', icon: 'none' })
        setTimeout(() => this.exitEdit(), 1200)
        return
      }
      this.me = m || {}
      if (item.publisherId !== ((m && m._id) || '')) {
        wx.showToast({ title: '只能编辑自己发布的信息', icon: 'none' })
        setTimeout(() => this.exitEdit(), 1200)
        return
      }
      const pi = this.data.placeList.indexOf(item.place)
      const ci = this.data.cateList.indexOf(item.category)
      this.setData({
        editId: item._id || id,
        isEdit: true,
        typeIndex: item.type === '招领' ? 1 : 0,
        title: item.title || '',
        desc: item.description || '',
        place: item.place || '',
        placeIndex: pi,
        date: item.time || '',
        category: item.category || '',
        cateIndex: ci,
        images: item.images || [],
        originalContact: item.contact || ''
      })
    }).catch(() => {
      wx.showToast({ title: '加载失败，请返回重试', icon: 'none' })
    })
  },

  onShow() {
    const tb = this.getTabBar && this.getTabBar()
    if (tb) tb.setData({ selected: 1 })
    this.checkAuth()

    // tabBar 页 onLoad 只执行一次，必须在这里读取全局的待编辑 id
    const app = getApp()
    const id = app && app.globalData && app.globalData.editItemId
    if (id) {
      app.globalData.editItemId = ''
      if (id !== this.data.editId || !this.data.isEdit) this.loadForEdit(id)
    }
  },

  // 退出编辑态，回到普通发布模式
  exitEdit() {
    this.setData({
      isEdit: false, editId: '', originalContact: '',
      typeIndex: 0, title: '', desc: '', place: '', placeIndex: -1,
      date: '', category: '', cateIndex: -1, images: []
    })
  },

  // 取消编辑并返回
  cancelEdit() {
    wx.showModal({
      title: '放弃编辑？',
      content: '当前修改不会被保存',
      confirmText: '放弃',
      confirmColor: '#F08A8A',
      success: r => {
        if (!r.confirm) return
        this.exitEdit()
        wx.navigateBack({
          delta: 1,
          fail: () => wx.switchTab({ url: '/pages/my-publish/my-publish' })
        })
      }
    })
  },

  checkAuth() {
    api.getMe().then(me => {
      this.me = me || {}
      this.setData({ certified: me && me.authStatus === '已认证' })
    }).catch(() => {})
  },

  // —— 类型切换 ——
  pickType(e) {
    this.setData({ typeIndex: Number(e.currentTarget.dataset.i) })
  },

  /**
   * 智能 AI 相机 —— 真实识别链路
   * ------------------------------------------------------------------
   * 1. wx.chooseMedia({ sourceType:['camera'] }) 调起系统相机
   *    （微信里打开摄像头必须由用户点击触发，不能用 getUserMedia）
   * 2. 压缩 → 上传云存储，拿到 fileID（本地临时路径云端读不到）
   * 3. 优先调云函数 ai-recognize（云开发 AI 视觉大模型）
   *    云函数没部署时，自动回退到小程序端 wx.cloud.extend.AI 直连
   * 4. 解析 JSON → 填充物品名称 / 描述 / 类别（不覆盖用户已填内容）
   */
  runAi() {
    if (this.data.aiScanning) return

    const onOk = res => {
      const f = (res.tempFiles && res.tempFiles[0]) || null
      if (!f) return
      // 拍照成功：把照片加进图片列表，并进入识别流程
      const imgs = this.data.images.concat([f.tempFilePath]).slice(0, 3)
      this.setData({ images: imgs })
      this.recognize(f.tempFilePath)
    }

    const onFail = err => {
      console.error('调起相机失败', err)
      const msg = String((err && err.errMsg) || '')
      // 用户拒绝授权 → 引导去设置页开启
      if (msg.indexOf('auth deny') > -1 || msg.indexOf('authorize') > -1 || msg.indexOf('permission') > -1) {
        wx.showModal({
          title: '需要相机/相册权限',
          content: '请在设置中允许「拍照」与「使用相册」，才能使用智能相机',
          confirmText: '去设置',
          success: r => { if (r.confirm) wx.openSetting({}) }
        })
        return
      }
      if (msg.indexOf('cancel') > -1) return   // 用户主动取消，不提示
      // 其它异常：退化为相册选图
      wx.showToast({ title: '相机不可用，请从相册选择', icon: 'none' })
      wx.chooseMedia({
        count: 1, mediaType: ['image'], sourceType: ['album'],
        success: onOk
      })
    }

    // 用回调写法（不依赖 Promise 化），兼容更低基础库
    if (wx.chooseMedia) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'],        // 直接调起系统相机（首次会申请权限）
        sizeType: ['compressed'],
        camera: 'back',
        success: onOk,
        fail: onFail
      })
    } else if (wx.chooseImage) {
      wx.chooseImage({
        count: 1, sizeType: ['compressed'], sourceType: ['camera'],
        success: onOk, fail: onFail
      })
    } else {
      wx.showToast({ title: '当前环境不支持拍照', icon: 'none' })
    }
  },

  /** 识别主流程 */
  recognize(tempPath) {
    this.setData({ aiScanning: true, aiDone: false, aiResult: '' })

    if (api.isMock() || !wx.cloud) {
      this.setData({ aiScanning: false })
      wx.showToast({ title: 'AI 识别需要云开发环境', icon: 'none' })
      return
    }

    const type = this.data.typeIndex === 0 ? '寻物' : '招领'

    this.compressImage(tempPath)
      .then(p => this.uploadOne(p, 'ai'))
      .then(fileID => this.callCloudAI(fileID, type))
      .then(data => this.fillFromAI(data))
      .catch(err => this.onAiFail(err))
  },

  /** 压缩：减小体积，避免超过模型输入上限 */
  compressImage(src) {
    return new Promise(resolve => {
      if (!wx.compressImage) return resolve(src)
      wx.compressImage({
        src,
        quality: 60,
        compressedWidth: 800,
        success: r => resolve((r && r.tempFilePath) || src),
        fail: () => resolve(src)      // 压缩失败就用原图
      })
    })
  },

  /** 单张上传云存储，返回 fileID */
  uploadOne(path, dir) {
    if (!path) return Promise.reject(new Error('图片路径为空'))
    if (String(path).indexOf('cloud://') === 0) return Promise.resolve(path)
    if (!wx.cloud || !wx.cloud.uploadFile) return Promise.reject(new Error('云存储不可用'))
    const ext = (String(path).match(/\.(\w+)$/) || [, 'jpg'])[1]
    const name = (dir || 'ai') + '/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.' + ext
    return wx.cloud.uploadFile({ cloudPath: name, filePath: path }).then(r => r.fileID)
  },

  /** 主通道：云函数 ai-recognize */
  callCloudAI(fileID, type) {
    return wx.cloud.callFunction({ name: 'ai-recognize', data: { fileID, type } })
      .then(res => {
        const r = res && res.result
        if (r && r.ok && r.data) return r.data
        const e = new Error((r && r.message) || '云函数返回异常')
        e.code = (r && r.code) || 'BAD_RESULT'
        throw e
      })
      .catch(err => {
        const msg = String((err && err.errMsg) || '')
        // 云函数尚未部署 → 走前端直连兜底
        const notDeployed = msg.indexOf('not be found') > -1
          || msg.indexOf('FunctionName') > -1
          || msg.indexOf('not found') > -1
          || (err && err.errCode === -501000)
        if (notDeployed) {
          console.warn('ai-recognize 云函数未部署，改用前端直连 AI')
          return this.callDirectAI(fileID, type)
        }
        throw err
      })
  },

  /** 备用通道：小程序端 wx.cloud.extend.AI 直连（基础库 3.7.1+） */
  callDirectAI(fileID, type) {
    const AI = wx.cloud && wx.cloud.extend && wx.cloud.extend.AI
    if (!AI || !AI.createModel) {
      const e = new Error('未开通云开发 AI')
      e.code = 'AI_NOT_ENABLED'
      return Promise.reject(e)
    }
    // 云存储临时链接 → 交给模型读取
    return wx.cloud.getTempFileURL({ fileList: [fileID] }).then(res => {
      const f = res.fileList && res.fileList[0]
      const url = f && f.tempFileURL
      if (!url) {
        const e = new Error('图片链接获取失败')
        e.code = 'NO_URL'
        throw e
      }
      const model = AI.createModel('hunyuan-exp')
      const p = model.generateText({
        model: 'hy3-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: aiParse.buildPrompt(type) },
            { type: 'image_url', image_url: { url } }
          ]
        }]
      })
      if (!p || typeof p.then !== 'function') {
        const e = new Error('当前基础库不支持 AI 调用')
        e.code = 'AI_NOT_ENABLED'
        throw e
      }
      return p
    }).then(res => {
      const obj = aiParse.extractJson(aiParse.textOf(res))
      if (!obj) {
        const e = new Error('模型返回无法解析')
        e.code = 'PARSE_FAIL'
        throw e
      }
      const data = aiParse.pickFields(obj)
      if (!data.title) {
        const e = new Error('模型未给出物品名称')
        e.code = 'PARSE_FAIL'
        throw e
      }
      return data
    })
  },

  /** 用识别结果填表：只填空着的字段，绝不覆盖用户已填内容 */
  fillFromAI(data) {
    const patch = { aiScanning: false, aiDone: true }
    const d = data || {}

    if (!this.data.title && d.title && d.title !== '无法辨认') patch.title = d.title
    if (!this.data.desc && d.desc) patch.desc = d.desc
    if (!this.data.category && d.category) {
      // 兜底归一：即便模型给出「校园卡」这类口语称呼，也能落到白名单选项上
      const cat = aiParse.normalizeCategory(d.category)
      const i = this.data.cateList.indexOf(cat)
      if (i > -1) { patch.category = cat; patch.cateIndex = i }
    }

    patch.aiResult = (d.title && d.title !== '无法辨认')
      ? (d.title + (d.category ? ' · ' + d.category : ''))
      : '照片看不清，请手动填写'

    this.setData(patch)

    if (d.title === '无法辨认') {
      wx.showToast({ title: '照片太模糊，请手动填写', icon: 'none' })
    } else {
      wx.showToast({ title: 'AI 已识别，请核对', icon: 'none' })
    }
    console.log('AI 识别结果:', d)
  },

  /** 识别失败：给出可执行的处理指引，绝不塞假数据 */
  onAiFail(err) {
    console.error('AI 识别失败', err)
    this.setData({ aiScanning: false, aiDone: false, aiResult: '' })
    const code = err && err.code
    if (code === 'AI_NOT_ENABLED') {
      wx.showModal({
        title: 'AI 能力未开通',
        content: '请在云开发控制台开通「AI / 大模型」，并部署 cloudfunctions/ai-recognize 云函数。现在可先手动填写物品信息。',
        showCancel: false,
        confirmText: '知道了'
      })
    } else if (code === 'PARSE_FAIL') {
      wx.showToast({ title: '识别不出来，请手动填写', icon: 'none' })
    } else {
      wx.showToast({ title: (err && err.message) || '识别失败，请手动填写', icon: 'none' })
    }
  },

  // —— 表单输入 ——
  onTitle(e)  { this.setData({ title: e.detail.value }) },
  onDesc(e)   { this.setData({ desc: e.detail.value }) },
  onContact(e){ this.setData({ contact: e.detail.value }) },

  // —— 选择器（原生 picker） ——
  onPlace(e) {
    const i = Number(e.detail.value)
    this.setData({ placeIndex: i, place: this.data.placeList[i] || '' })
  },
  onDate(e)  { this.setData({ date: e.detail.value }) },
  onCate(e)  {
    const i = Number(e.detail.value)
    this.setData({ cateIndex: i, category: this.data.cateList[i] || '' })
  },

  addImage() {
    const left = 3 - this.data.images.length
    if (left <= 0) { wx.showToast({ title: '最多3张', icon: 'none' }); return }
    wx.chooseMedia({
      count: left,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: res => {
        const imgs = this.data.images.concat(res.tempFiles.map(f => f.tempFilePath))
        this.setData({ images: imgs.slice(0, 3) })
      }
    })
  },

  delImage(e) {
    const i = Number(e.currentTarget.dataset.i)
    const imgs = this.data.images.slice()
    imgs.splice(i, 1)
    this.setData({ images: imgs })
  },

  /**
   * 把本地临时路径上传到云存储，返回 fileID 数组。
   * 关键：wx.chooseMedia 拿到的是 tempFilePath（仅本机可用），
   * 必须上传后才能在其他设备（手机端）正常显示。
   * 已经是 cloud:// 的（编辑时未改动的旧图）原样保留，不重复上传。
   */
  uploadImages(paths) {
    paths = paths || []
    if (!paths.length) return Promise.resolve([])

    // Mock 模式或云能力不可用时，直接原样返回（本地预览用）
    if (!wx.cloud || api.isMock()) return Promise.resolve(paths)

    const tasks = paths.map((p, i) => {
      if (String(p).indexOf('cloud://') === 0) return Promise.resolve(p)
      const ext = (String(p).match(/\.(\w+)$/) || [, 'png'])[1]
      const name = 'items/' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1e6) + '.' + ext
      return wx.cloud.uploadFile({ cloudPath: name, filePath: p })
        .then(r => r.fileID)
        .catch(err => {
          console.error('图片上传失败', err)
          // 单张失败不阻断整体，返回空串以便后续过滤
          return ''
        })
    })
    return Promise.all(tasks).then(list => list.filter(Boolean))
  },

  // —— 发布 ——
  submit() {
    if (!this.data.certified) {
      wx.showModal({
        title: '需要实名认证',
        content: '发布信息前请先完成实名认证',
        confirmText: '去认证',
        success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/auth/auth' }) }
      })
      return
    }
    const { title, place, typeIndex, desc, category, images } = this.data
    if (!title) return this.toast('请填写物品名称')
    if (!place) return this.toast('请选择位置')

    // 日期可选，默认今天
    const date = this.data.date || util.today()
    // 联系方式：优先实名认证资料里的手机号；编辑时若为空则保留原值
    const contact = (this.me && (this.me.phone || this.me.contact))
      || this.data.originalContact
      || ''
    if (!contact) {
      wx.showModal({
        title: '缺少联系方式',
        content: '实名认证资料中未找到手机号，请先补全后再发布',
        confirmText: '去认证',
        success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/auth/auth' }) }
      })
      return
    }

    this.setData({ submitting: true })

    // 先把本地临时图片上传到云存储，拿到 fileID 再落库
    // （否则手机上取不到 tempFilePath，图片会变成空白）
    this.uploadImages(images).then(fileIDs => {
      const payload = {
        type: typeIndex === 0 ? '寻物' : '招领',
        title, description: desc, place, category,
        time: date, contact, images: fileIDs
      }

      // 编辑模式：走 updateItem；发布模式：走 createItem
      const task = this.data.isEdit
        ? api.updateItem(this.data.editId, payload)
        : api.createItem(payload)

      const failMsg = this.data.isEdit ? '保存失败，请重试' : '发布失败，请重试'

      return task.then(item => {
        this.setData({ submitting: false })
        if (this.data.isEdit) {
          wx.showToast({ title: '已保存', icon: 'success' })
          this.exitEdit()
          setTimeout(() => {
            wx.navigateBack({
              delta: 1,
              fail: () => wx.switchTab({ url: '/pages/my-publish/my-publish' })
            })
          }, 900)
        } else {
          wx.redirectTo({ url: '/pages/publish-success/publish-success?id=' + ((item && (item._id || item.id)) || '') })
        }
      }).catch(err => {
        this.setData({ submitting: false })
        this.toast((err && err.msg) || failMsg)
      })
    }).catch(err => {
      this.setData({ submitting: false })
      console.error('图片上传失败', err)
      this.toast('图片上传失败，请重试')
    })
  },

  toast(t) { wx.showToast({ title: t, icon: 'none' }) },

  back() { wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/index/index' }) }) }
})
