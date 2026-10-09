const api = require('../../utils/api.js')
const icons = require('../../utils/icons.js')

const STATUS = {
  '未认证': { tone: 'purple', title: '还未完成实名认证', sub: '填写资料即可完成认证并发布信息', icon: 'shield' },
  '审核中': { tone: 'warn',   title: '资料已提交，等待审核', sub: '管理员审核通过后即可发布 / 联系',   icon: 'clock' },
  '已认证': { tone: 'mint',   title: '已完成实名认证',       sub: '你可以发布信息并查看联系方式',       icon: 'shield' },
  '已驳回': { tone: 'danger', title: '认证未通过',           sub: '请根据驳回原因修改后重新提交',       icon: 'info' }
}

Page({
  data: {
    status: '未认证',
    reason: '',
    canSubmit: true,
    submitting: false,
    form: { realName: '', studentId: '', college: '', phone: '' },
    banner: { tone: 'purple', title: '', sub: '' },
    bannerIcon: '',
    ico: {},
    mascot: '/assets/images/mascot-bunny.png'
  },

  onLoad() {
    this.setData({
      ico: {
        user:   icons.icon('user',   '#8B6FE8', 34),
        tag:    icons.icon('tag',    '#8B6FE8', 34),
        grid:   icons.icon('grid',   '#8B6FE8', 34),
        image:  icons.icon('image',  '#8B6FE8', 34),
        phone:  icons.icon('phone',  '#8B6FE8', 34),
        shield: icons.icon('shield', '#FFFFFF', 44),
        clock:  icons.icon('clock',  '#FFFFFF', 44),
        info:   icons.icon('info',   '#FFFFFF', 44),
        camera: icons.icon('camera', '#8B6FE8', 46)
      }
    })
  },

  onShow() { this.refresh() },

  refresh() {
    api.getMe().then(me => {
      const s = me.authStatus || '未认证'
      const cfg = STATUS[s] || STATUS['未认证']
      this.setData({
        status: s,
        reason: me.authReason || '',
        canSubmit: s === '未认证' || s === '已驳回',
        banner: {
          tone: cfg.tone,
          title: cfg.title,
          sub: (s === '已驳回' && me.authReason) ? me.authReason : cfg.sub
        },
        bannerIcon: this.data.ico[cfg.icon] || this.data.ico.shield,
        form: {
          realName: me.realName || '',
          studentId: me.studentId || '',
          college: me.college || '',
          phone: me.phone || ''
        }
      })
    })
  },

  onInput(e) {
    this.setData({ ['form.' + e.currentTarget.dataset.f]: e.detail.value })
  },

  onSubmit() {
    if (!this.data.canSubmit) return
    const f = this.data.form
    if (!f.realName)  return wx.showToast({ title: '请填写真实姓名', icon: 'none' })
    if (!f.studentId) return wx.showToast({ title: '请填写学号', icon: 'none' })
    if (!f.phone)     return wx.showToast({ title: '请填写手机号', icon: 'none' })

    this.setData({ submitting: true })
    api.submitAuth({
      realName: f.realName, studentId: f.studentId,
      college: f.college, phone: f.phone
    }).then(() => {
      this.setData({ submitting: false })
      wx.showToast({ title: '认证成功', icon: 'success' })
      this.refresh()
    }).catch(err => {
      this.setData({ submitting: false })
      wx.showToast({ title: '提交失败，请重试', icon: 'none' })
      console.error(err)
    })
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/profile/profile' })
  }
})
