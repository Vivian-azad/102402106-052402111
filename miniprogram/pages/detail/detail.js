const api = require('../../utils/api.js')
const icons = require('../../utils/icons.js')
const cate = require('../../utils/category.js')

Page({
  data: {
    id: '',
    item: null,
    certified: false,
    isPublisher: false,
    showStatusPop: false,
    thumbSrc: '',
    fallbackThumb: '',
    thumbFailed: false,
    badgeText: '寻物',
    badgeTone: 'mint',
    statusText: '',
    statusTone: 'mint',
    timeText: '',
    ico: {}
  },

  onLoad(q) {
    this.setData({
      id: q.id || '',
      ico: {
        back:   icons.icon('arrow',  '#3A3752', 26),
        pin:    icons.icon('map',    '#8B6FE8', 30),
        clock:  icons.icon('clock',  '#8B6FE8', 30),
        user:   icons.icon('user',   '#8B6FE8', 30),
        copy:   icons.icon('copy',   '#FFFFFF', 32),
        shield: icons.icon('shield', '#8B6FE8', 44),
        phone:  icons.icon('phone',  '#FFFFFF', 34),
        edit:   icons.icon('edit',   '#FFFFFF', 34),
        info:   icons.icon('info',   '#9C99B0', 28)
      }
    })
    this.load()
  },

  load() {
    Promise.all([api.getItem(this.data.id), api.getMe()]).then(([item, m]) => {
      if (!item) {
        wx.showToast({ title: '信息不存在或已删除', icon: 'none' })
        setTimeout(() => this.onBack(), 1200)
        return
      }

      const imgs = {
        bag: '/assets/images/item-bag.png', phone: '/assets/images/item-phone.png',
        earbuds: '/assets/images/item-earbuds.png', bottle: '/assets/images/item-bottle.png',
        scarf: '/assets/images/item-scarf.png', glasses: '/assets/images/item-glasses.png',
        key: '/assets/images/item-key.png', laptop: '/assets/images/item-laptop.png',
        wallet: '/assets/images/item-wallet.png', card: '/assets/images/item-card.png',
        jacket: '/assets/images/item-jacket.png', book: '/assets/images/item-book.png'
      }
      // 纯类别匹配：按用户选择的类别显示对应图标（无关键词识别）
      const r = cate.resolveCategoryIcon(item.category, item.type)
      const cateIcon = imgs[r.key] || imgs.bag
      // 有用户上传的真实照片就优先展示，图标作兜底
      const hasPhoto = !!(item.images && item.images.length)

      const st = item.status === '已通过' ? '进行中' : item.status
      const toneMap = {
        '进行中': 'mint', '已完成': 'gray', '待审核': 'warn',
        '已驳回': 'danger', '已下架': 'danger'
      }

      this.setData({
        item,
        thumbSrc: hasPhoto ? item.images[0] : cateIcon,
        fallbackThumb: cateIcon,
        thumbFailed: false,
        badgeText: item.type === '招领' ? '招领' : '寻物',
        badgeTone: item.type === '招领' ? 'purple' : 'mint',
        certified: !!(m && m.authStatus === '已认证'),
        isPublisher: !!(m && m._id === item.publisherId),
        statusText: st,
        statusTone: toneMap[st] || 'gray',
        timeText: fmt(item.time || item.createTime)
      })
    }).catch(err => {
      console.error('详情加载失败', err)
      wx.showToast({ title: '加载失败，请返回重试', icon: 'none' })
    })
  },

  // 头图加载失败 → 退回类别图标
  onThumbError() {
    if (this.data.thumbFailed) return
    this.setData({ thumbFailed: true, thumbSrc: this.data.fallbackThumb })
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  copyContact() {
    if (!this.data.certified) {
      wx.showToast({ title: '请先完成实名认证', icon: 'none' })
      setTimeout(() => wx.navigateTo({ url: '/pages/auth/auth' }), 1200)
      return
    }
    wx.setClipboardData({
      data: this.data.item.contact,
      success: () => wx.showToast({ title: '已复制联系方式', icon: 'none' })
    })
  },

  contactTa() {
    if (!this.data.certified) {
      wx.showModal({
        title: '需要实名认证',
        content: '查看完整联系方式前，请先完成实名认证',
        confirmText: '去认证',
        success: r => { if (r.confirm) wx.navigateTo({ url: '/pages/auth/auth' }) }
      })
      return
    }
    this.copyContact()
  },

  goAuth() { wx.navigateTo({ url: '/pages/auth/auth' }) },

  openStatusPop() { this.setData({ showStatusPop: true }) },
  closePop() { this.setData({ showStatusPop: false }) },

  confirmStatus() {
    api.updateItemStatus(this.data.id, '已完成').then(() => {
      this.setData({ showStatusPop: false })
      wx.showToast({ title: '状态已更新', icon: 'success' })
      this.load()
    })
  },

  report() {
    wx.showModal({
      title: '举报该信息',
      editable: true,
      placeholderText: '请填写举报原因',
      success: r => {
        if (r.confirm && r.content) {
          api.createReport(this.data.id, r.content).then(() => {
            wx.showToast({ title: '举报已提交', icon: 'success' })
          })
        }
      }
    })
  },

  noop() {}
})

function fmt(v) {
  if (!v) return ''
  const m = String(v).replace('T', ' ').match(/^(\d{4})-(\d{2})-(\d{2})[ ]?(\d{2}:\d{2})?/)
  if (m) return Number(m[2]) + '月' + Number(m[3]) + '日' + (m[4] ? ' ' + m[4] : '')
  return String(v)
}
