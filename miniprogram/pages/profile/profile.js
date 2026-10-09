const api = require('../../utils/api.js')
const icons = require('../../utils/icons.js')

const AUTH = {
  '未认证': { tone: 'gray',   text: '未认证' },
  '审核中': { tone: 'warn',   text: '审核中' },
  '已认证': { tone: 'mint',   text: '已认证' },
  '已驳回': { tone: 'danger', text: '已驳回' }
}

Page({
  data: {
    me: {},
    nick: '微信用户',
    authText: '未认证',
    authTone: 'gray',
    myCount: 0,
    doneCount: 0,
    navTop: 54,
    defaultAvatar: '/assets/images/mascot-bunny.png',
    avatar: '/assets/images/mascot-bunny.png',
    ico: {},
    logoMint: '' ,
    logoPurple: ''
  },

  onLoad() {
    this.setData({
      ico: {
        doc:    icons.icon('doc',    '#8B6FE8', 34),
        shield: icons.icon('shield', '#8B6FE8', 34),
        grid:   icons.icon('grid',   '#8B6FE8', 34),
        info:   icons.icon('info',   '#8B6FE8', 34),
        chev:   icons.icon('arrow',  '#C9C6D8', 24)
      }
    })
  },

  // 顶部留白：按机型状态栏高度动态计算，避免标题被状态栏/胶囊遮挡
  calcNavTop() {
    let top = 54
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const sb = (info && info.statusBarHeight) || 20
      top = Math.round(sb + 4)
    } catch (e) { /* 取不到就用默认值 */ }
    return top
  },

  onShow() {
    if (this.getTabBar) this.getTabBar().setData({ selected: 2 })
    // 每次都重算：部分机型旋转/分屏后状态栏高度会变
    const navTop = this.calcNavTop()
    if (navTop !== this.data.navTop) this.setData({ navTop })
    api.getMe().then(res => {
      const me = res || {}
      const a = AUTH[me.authStatus] || AUTH['未认证']
      this.setData({
        me,
        nick: me.nickname || '微信用户',
        authText: a.text,
        authTone: a.tone,
        // 用户已设置头像就用，否则用默认兔子
        avatar: me.avatar || me.avatarUrl || this.data.defaultAvatar
      })
    })
    api.listMyItems().then(list => {
      list = list || []
      this.setData({
        myCount: list.length,
        doneCount: list.filter(i => i.status === '已完成').length
      })
    }).catch(() => {})
  },

  // 头像加载失败 → 回退默认图
  onAvatarError() {
    this.setData({ avatar: this.data.defaultAvatar })
  },

  // —— 编辑个人资料（头像 / 用户名 / 联系方式）——
  goEditProfile() { wx.navigateTo({ url: '/pages/edit-profile/edit-profile' }) },

  goMyPublish() { wx.navigateTo({ url: '/pages/my-publish/my-publish' }) },
  goAuth()      { wx.navigateTo({ url: '/pages/auth/auth' }) },

  goAdmin() {
    wx.showModal({
      title: '管理后台',
      content: 'Web 后台入口：在浏览器打开本地服务地址（默认 http://localhost:8080）即可使用数据概览、信息审核、用户管理等功能。',
      showCancel: false, confirmText: '知道了'
    })
  },

  goAbout() {
    wx.showModal({
      title: '关于我们',
      content: '校园失物招领小程序\n为同学提供寻物 / 招领信息发布与查找平台。\n实名认证保障信息真实，让失物更快回家。',
      showCancel: false, confirmText: '知道了'
    })
  },

  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }) }
})
