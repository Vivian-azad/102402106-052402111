/**
 * seed.js —— 内置种子数据
 * 与小程序 miniprogram/utils/mockData.js 保持一致，
 * 首次打开网页时写入 localStorage，之后所有增删改都持久化。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.Seed = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {

  const C = (typeof Core !== 'undefined' ? Core : require('./core.js'))

  function at(days, h, m) {
    const d = C.daysAgo(days)
    d.setHours(h, m, 0, 0)
    return C.formatDateTime(d)
  }

  // 当前用户（默认登录身份，用于「我的发布」演示）
  const me = {
    _id: 'u1', nickname: '林小满', realName: '林小满', studentId: '2023010123',
    college: '计算机学院 软件2301', phone: '13800001111', role: '学生'
  }

  const users = [
    { _id: 'u1', nickname: '林小满', phone: '13800001111' },
    { _id: 'u2', nickname: '陈拾意', phone: '13800002222' },
    { _id: 'u3', nickname: '王觅觅', phone: '13800003333' },
    { _id: 'u4', nickname: '赵缺缺', phone: '13800004444' }
  ]

  const items = [
    { _id: 'i1', type: '寻物', title: '校园卡', description: '黑色校园卡，卡面有轻微划痕，丢失时装在透明卡套里。', place: '教学楼', category: '证件卡类', time: at(0, 14, 30), contact: 'wxid_lin123', status: '进行中', publisherId: 'u1', createTime: at(0, 14, 35) },
    { _id: 'i2', type: '寻物', title: '蓝牙耳机', description: '白色 AirPods，右耳有划痕，遗失在图书馆三楼。', place: '图书馆', category: '电子产品', time: at(1, 16, 10), contact: '13800002222', status: '进行中', publisherId: 'u2', createTime: at(1, 16, 20) },
    { _id: 'i3', type: '招领', title: '折叠雨伞', description: '蓝色长柄折叠伞，拾于食堂门口伞架上。', place: '食堂', category: '生活用品', time: at(1, 12, 0), contact: 'wx_chen', status: '进行中', publisherId: 'u2', createTime: at(1, 12, 30) },
    { _id: 'i4', type: '寻物', title: '双肩书包', description: '灰色耐克双肩包，内有课本若干，已找回。', place: '体育馆', category: '学习用品', time: at(4, 18, 0), contact: 'wxid_lin123', status: '已找到', publisherId: 'u1', createTime: at(4, 18, 30) },
    { _id: 'i5', type: '招领', title: '房门钥匙', description: '一串钥匙，挂红色小熊挂件，拾于宿舍楼下。', place: '宿舍区', category: '钥匙', time: at(2, 20, 0), contact: '13800003333', status: '进行中', publisherId: 'u3', createTime: at(2, 20, 10) },
    { _id: 'i6', type: '寻物', title: '高数笔记本', description: '蓝色封面笔记本，写有高数笔记。', place: '教学楼', category: '学习用品', time: at(0, 10, 0), contact: 'wx_chen', status: '进行中', publisherId: 'u2', createTime: at(0, 10, 5) },
    { _id: 'i7', type: '寻物', title: '学生证', description: '红色封皮学生证。', place: '食堂', category: '证件卡类', time: at(2, 13, 0), contact: '13800003333', status: '进行中', publisherId: 'u3', createTime: at(2, 13, 20) },
    { _id: 'i8', type: '招领', title: '保温水杯', description: '白色保温杯，拾于图书馆。', place: '图书馆', category: '生活用品', time: at(3, 9, 0), contact: 'wxid_lin123', status: '进行中', publisherId: 'u1', createTime: at(3, 9, 10) },
    { _id: 'i9', type: '招领', title: '充电宝', description: '黑色小米充电宝，已归还失主。', place: '教学楼', category: '电子产品', time: at(5, 15, 0), contact: 'wx_chen', status: '已归还', publisherId: 'u2', createTime: at(5, 15, 10) },
    { _id: 'i10', type: '寻物', title: '近视眼镜', description: '黑框近视眼镜，度数较高，遗失在宿舍。', place: '宿舍区', category: '配饰', time: at(1, 22, 0), contact: '13800004444', status: '进行中', publisherId: 'u4', createTime: at(1, 22, 10) }
  ]

  const places = [
    { _id: 'p1', name: '图书馆' },
    { _id: 'p2', name: '食堂' },
    { _id: 'p3', name: '教学楼' },
    { _id: 'p4', name: '宿舍区' },
    { _id: 'p5', name: '体育馆' },
    { _id: 'p6', name: '其他' }
  ]

  return {
    me,
    seed() {
      return {
        me: JSON.parse(JSON.stringify(me)),
        users: JSON.parse(JSON.stringify(users)),
        items: JSON.parse(JSON.stringify(items)),
        places: JSON.parse(JSON.stringify(places))
      }
    }
  }
})
