const api = require('../../utils/api.js')
const icons = require('../../utils/icons.js')

// 本地上传：临时路径 → 云存储 fileID（与 auth 页同一套写法）
function uploadAvatar(path) {
  if (!path) return Promise.resolve('')
  // 已经是云文件或 mock 模式，直接返回
  if (String(path).indexOf('cloud://') === 0 || api.isMock() || !wx.cloud || !wx.cloud.uploadFile) {
    return Promise.resolve(path)
  }
  const m = String(path).match(/\.(\w+)$/)
  const ext = m ? m[1] : 'png'
  return wx.cloud.uploadFile({
    cloudPath: 'avatars/' + Date.now() + '_' + Math.floor(Math.random() * 1e6) + '.' + ext,
    filePath: path
  }).then(r => r.fileID)
}

Page({
  data: {
    nickname: '',
    phone: '',
    avatar: '',
    origAvatar: '',
    saving: false,
    ico: {},
    navTop: 54,                 // 顶部安全留白（按机型动态计算，避免被状态栏/胶囊遮挡）
    defaultAvatar: '/assets/images/mascot-bunny.png'
  },

  onLoad() {
    this.setData({
      navTop: this.calcNavTop(),
      ico: {
        user:   icons.icon('user',   '#8B6FE8', 34),
        phone:  icons.icon('phone',  '#8B6FE8', 34),
        camera: icons.icon('camera', '#FFFFFF', 30)
      }
    })
  },

  // 顶部留白：让自定义标题行与右侧胶囊垂直对齐
  calcNavTop() {
    let top = 54
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const sb = (info && info.statusBarHeight) || 20
      let mb = null
      try { if (wx.getMenuButtonBoundingClientRect) mb = wx.getMenuButtonBoundingClientRect() } catch (e) { mb = null }
      if (mb && mb.top) {
        // 行高 84rpx ≈ 42px，取胶囊中心 - 半个行高
        top = Math.round(Math.max(sb + 4, mb.top + mb.height / 2 - 21))
      } else {
        top = Math.round(sb + 4)
      }
    } catch (e) { /* 取不到就用默认值 */ }
    return top
  },

  onShow() { this.load() },

  load() {
    api.getMe().then(me => {
      me = me || {}
      const avatar = me.avatar || me.avatarUrl || this.data.defaultAvatar
      this.setData({
        nickname: me.nickname || '',
        phone: me.phone || '',
        avatar,
        origAvatar: avatar
      })
    })
  },

  onNick(e)  { this.setData({ nickname: e.detail.value }) },
  onPhone(e) { this.setData({ phone: e.detail.value }) },

  // 选头像：相册或拍照
  chooseAvatar() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: res => {
        const f = res.tempFiles && res.tempFiles[0]
        if (f) this.setData({ avatar: f.tempFilePath })
      }
    })
  },

  // 头像加载失败回退默认图
  onAvatarError() {
    this.setData({ avatar: this.data.defaultAvatar })
  },

  previewAvatar() {
    if (!this.data.avatar) return
    wx.previewImage({ urls: [this.data.avatar] })
  },

  save() {
    if (this.data.saving) return
    const nickname = String(this.data.nickname || '').trim()
    if (!nickname) return wx.showToast({ title: '请填写用户名', icon: 'none' })
    if (nickname.length > 20) return wx.showToast({ title: '用户名不超过 20 个字', icon: 'none' })

    // 允许：手机号（6-20 位纯数字）或微信号（字母开头，6-20 位字母/数字/下划线/减号）
    const phone = String(this.data.phone || '').trim()
    if (phone && !/^(\d{6,20}|[a-zA-Z][-_a-zA-Z0-9]{5,19})$/.test(phone)) {
      return wx.showToast({ title: '请填写正确的手机号或微信号', icon: 'none' })
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '保存中…', mask: true })

    uploadAvatar(this.data.avatar)
      .catch(() => this.data.origAvatar)   // 上传失败就保留原头像，不阻断保存
      .then(avatar => api.updateUser({ nickname, phone, avatar }))
      .then(() => {
        wx.hideLoading()
        this.setData({ saving: false })
        wx.showToast({ title: '资料已保存', icon: 'success' })
        // 通知来源页刷新
        const pages = getCurrentPages()
        const prev = pages[pages.length - 2]
        if (prev && prev.onShow) prev.onShow()
        setTimeout(() => wx.navigateBack({
          delta: 1,
          fail: () => wx.switchTab({ url: '/pages/profile/profile' })
        }), 900)
      })
      .catch(err => {
        wx.hideLoading()
        this.setData({ saving: false })
        wx.showToast({ title: (err && err.msg) || '保存失败，请重试', icon: 'none' })
        console.error(err)
      })
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/profile/profile' })
  }
})
