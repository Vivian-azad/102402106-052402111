Page({
  data: { id: '' },
  onLoad(q) {
    this.setData({ id: q.id || '' })
  },
  goDetail() {
    if (this.data.id) {
      wx.redirectTo({ url: '/pages/detail/detail?id=' + this.data.id })
    } else {
      this.goHome()
    }
  },
  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
