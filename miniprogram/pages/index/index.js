const api = require('../../utils/api')
const icons = require('../../utils/icons')

Page({
  data: {
    tabs: ['全部', '寻物', '招领'],
    active: 0,
    list: [],
    loading: true,
    // 图标
    icoPublish: '',
    icoMine: '',
    icoBell: '',
    icoArrow: '',
    icoPinMint: '',
    icoPinPurple: '',
    icoBook: '',
    hero: '/assets/images/hero-campus.jpg',
    avatar: '/assets/images/mascot-bunny.png',
    // 校园图上的浮动地点气泡（坐标按新头图建筑位置标定，纯展示不可点击）
    // 图布局：左上楼群(教学楼) / 中上玻璃圆顶主楼(图书馆) / 右上高楼(晋江楼) / 左侧田径跑道(体育馆)
    spots: [
      { name: '教学楼', x: 20, y: 22, tone: 'mint' },
      { name: '图书馆', x: 52, y: 30, tone: 'purple' },
      { name: '晋江楼', x: 76, y: 16, tone: 'mint' },
      { name: '体育馆', x: 15, y: 52, tone: 'purple' }
    ]
  },

  onLoad() {
    this.setData({
      icoPublish: icons.icon('plus',  '#2A2740', 30),
      icoMine:    icons.icon('user',  '#2A2740', 30),
      icoBell:    icons.icon('bell',  '#2A2740', 32),
      icoArrow:   icons.icon('arrow', '#9C99B0', 22),
      icoSearch:  icons.icon('search', '#9C99B0', 34),
      icoBook:    icons.icon('box',   '#FFFFFF', 20)
    })
    this.loadList()
  },

  onShow() {
    if (this.getTabBar) this.getTabBar().setData({ selected: 0 })
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList(() => wx.stopPullDownRefresh())
  },

  loadList(done) {
    const type = this.data.active === 0 ? '' : this.data.tabs[this.data.active]
    this.setData({ loading: true })
    api.listItems({ type, status: '已通过' })
      .then(res => {
        // listItems 返回 { list, total } 对象，取 .list
        const arr = (res && res.list) || []
        this.setData({ list: arr, loading: false })
        done && done()
      })
      .catch(err => {
        console.error('首页列表加载失败', err)
        wx.showToast({ title: '列表加载失败，请下拉重试', icon: 'none' })
        this.setData({ list: [], loading: false })
        done && done()
      })
  },

  switchTab(e) {
    const i = Number(e.currentTarget.dataset.i)
    if (i === this.data.active) return
    this.setData({ active: i }, () => this.loadList())
  },

  goSearch()    { wx.navigateTo({ url: '/pages/search/search' }) },
  goPublish()   { wx.switchTab({ url: '/pages/publish/publish' }) },
  goMine()      { wx.switchTab({ url: '/pages/profile/profile' }) },
  goAll()       { wx.navigateTo({ url: '/pages/search/search' }) },
  goDetail(e) {
    const id = e.detail && e.detail.id
    if (id) wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  noop() {}
})
