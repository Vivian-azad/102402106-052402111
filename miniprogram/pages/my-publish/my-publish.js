const api = require('../../utils/api.js')

Page({
  data: {
    list: [],
    loading: true,
    doneCount: 0,
    waitCount: 0
  },

  onShow() { this.load() },

  onPullDownRefresh() { this.load(() => wx.stopPullDownRefresh()) },

  load(done) {
    api.listMyItems().then(list => {
      list = list || []
      const doneCnt = list.filter(i => i.status === '已完成').length
      this.setData({
        list,
        loading: false,
        doneCount: doneCnt,
        waitCount: list.length - doneCnt
      })
      done && done()
    }).catch(() => {
      this.setData({ loading: false })
      done && done()
    })
  },

  onCard(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.detail.id })
  },

  // —— 编辑：跳发布页复用表单 ——
  // 注意：publish 是 tabBar 页面，navigateTo 跳不过去，switchTab 又不支持带参，
  // 所以先把待编辑 id 存到全局，再由发布页在 onShow 里读取。
  onEdit(e) {
    const id = e.detail && e.detail.id
    if (!id) return
    const app = getApp()
    if (app && app.globalData) app.globalData.editItemId = id
    wx.switchTab({
      url: '/pages/publish/publish',
      fail: () => {
        if (app && app.globalData) app.globalData.editItemId = ''
        wx.showToast({ title: '打开编辑页失败', icon: 'none' })
      }
    })
  },

  // —— 删除：二次确认后移除 ——
  onDelete(e) {
    const id = e.detail && e.detail.id
    if (!id) return
    wx.showModal({
      title: '删除这条信息？',
      content: '删除后无法恢复，也不会再展示给其他人',
      confirmText: '删除',
      confirmColor: '#F08A8A',
      success: r => {
        if (!r.confirm) return
        wx.showLoading({ title: '删除中…', mask: true })
        api.removeItem(id).then(() => {
          wx.hideLoading()
          wx.showToast({ title: '已删除', icon: 'success' })
          this.load()
        }).catch(err => {
          wx.hideLoading()
          wx.showToast({ title: (err && err.msg) || '删除失败，请重试', icon: 'none' })
        })
      }
    })
  },

  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' })
  },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/profile/profile' })
  }
})
