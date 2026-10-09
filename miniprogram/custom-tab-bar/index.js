const icons = require('../utils/icons')

Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index',     text: '首页', key: 'home' },
      { pagePath: '/pages/publish/publish', text: '发布', key: 'doc' },
      { pagePath: '/pages/profile/profile', text: '我的', key: 'user' }
    ],
    icoOn: {},
    icoOff: {}
  },

  lifetimes: {
    attached() {
      const on = {}, off = {}
      this.data.list.forEach(t => {
        on[t.key]  = icons.icon(t.key, '#3ECFA0', 46)
        off[t.key] = icons.icon(t.key, '#B7B4C7', 46)
      })
      this.setData({ icoOn: on, icoOff: off })
    }
  },

  methods: {
    switchTab(e) {
      const i = Number(e.currentTarget.dataset.i)
      const url = this.data.list[i].pagePath
      if (i === this.data.selected) return
      wx.switchTab({ url })
    }
  }
})
