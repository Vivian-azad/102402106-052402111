const api = require('../../utils/api')
const icons = require('../../utils/icons')

const TYPES  = ['全部', '寻物', '招领']
const PLACES = ['全部', '图书馆', '食堂', '教学楼', '宿舍区', '晋江楼', '体育馆']
const TIMES  = ['全部', '今天', '近三天', '近一周']
const TIME_MAP = { '今天': 'today', '近三天': '3d', '近一周': '7d' }

Page({
  data: {
    keyword: '',
    searched: false,
    typeIdx: 0, placeIdx: 0, timeIdx: 0,
    types: TYPES, places: PLACES, times: TIMES,
    list: [],
    brandTop: 54,
    ico: {}
  },

  onLoad(opt) {
    // 品牌区整体下移：避开状态栏与右上角胶囊（不留多余空白）
    let brandTop = 54
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      const sb = (info && info.statusBarHeight) || 20
      brandTop = Math.round(sb + 4)
    } catch (e) { /* 取不到就用默认值 */ }

    this.setData({
      brandTop,
      ico: {
        search: icons.icon('search', '#B7B4C7', 34),
        close:  icons.icon('close',  '#B7B4C7', 26),
        pin:    icons.icon('map',    '#3ECFA0', 26)
      }
    })
    const place = opt && opt.place
    if (place) {
      const i = PLACES.indexOf(place)
      if (i > -1) { this.setData({ placeIdx: i }); this.onSearch() }
    }
  },

  onInput(e) { this.setData({ keyword: e.detail.value }) },

  onType(e)  { this.setData({ typeIdx:  Number(e.currentTarget.dataset.i) }, () => this.onSearch()) },
  onPlace(e) { this.setData({ placeIdx: Number(e.currentTarget.dataset.i) }, () => this.onSearch()) },
  onTime(e)  { this.setData({ timeIdx:  Number(e.currentTarget.dataset.i) }, () => this.onSearch()) },

  clearKw() { this.setData({ keyword: '' }, () => this.onSearch()) },

  onBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) wx.navigateBack()
    else wx.switchTab({ url: '/pages/index/index' })
  },

  onSearch() {
    const q = {}
    const t  = this.data.types[this.data.typeIdx]
    const p  = this.data.places[this.data.placeIdx]
    const tm = this.data.times[this.data.timeIdx]
    if (this.data.typeIdx > 0)  q.type = t
    if (this.data.placeIdx > 0) q.place = p
    if (TIME_MAP[tm]) q.timeRange = TIME_MAP[tm]
    if (this.data.keyword) q.keyword = this.data.keyword

    api.listItems(q).then(res => {
      const list = res && res.list ? res.list : (res || [])
      this.setData({ list, searched: true })
    }).catch(() => this.setData({ searched: true }))
  },

  onCard(e) {
    wx.navigateTo({ url: '/pages/detail/detail?id=' + e.detail.id })
  },

  goPublish() { wx.switchTab({ url: '/pages/publish/publish' }) }
})
