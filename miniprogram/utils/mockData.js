// Mock 种子数据（useMock=true 时使用）
// 仅用于开发者工具本地预览；云模式下不会用到本文件。
const { formatDateTime, daysAgo } = require('./util.js')

function at(days, h, m) {
  const d = daysAgo(days)
  d.setHours(h, m, 0, 0)
  return formatDateTime(d)
}

const users = [
  {
    _id: 'u1', nickname: '林小满', realName: '林小满', studentId: '2023010123',
    college: '计算机学院 软件2301', phone: '13800001111', cardImage: '',
    authStatus: '已认证', authReason: '', role: '学生', status: '正常',
    createTime: at(30, 9, 0)
  },
  {
    _id: 'u2', nickname: '陈拾意', realName: '陈拾意', studentId: '2023010456',
    college: '外国语学院 英语2302', phone: '13800002222', cardImage: '',
    authStatus: '已认证', authReason: '', role: '学生', status: '正常',
    createTime: at(28, 10, 0)
  },
  {
    _id: 'u3', nickname: '王觅觅', realName: '王觅觅', studentId: '2023010789',
    college: '数学学院 统计2301', phone: '13800003333', cardImage: '',
    authStatus: '审核中', authReason: '', role: '学生', status: '正常',
    createTime: at(5, 11, 0)
  },
  {
    _id: 'u4', nickname: '赵缺缺', realName: '赵缺缺', studentId: '2023010900',
    college: '物理学院 物理2303', phone: '13800004444', cardImage: '',
    authStatus: '已驳回', authReason: '校园卡照片不清晰，请重新上传', role: '学生', status: '正常',
    createTime: at(3, 14, 0)
  },
  {
    _id: 'admin', nickname: '管理员', realName: '系统管理员', studentId: '0000',
    college: '校学生处', phone: '00000000000', cardImage: '',
    authStatus: '已认证', authReason: '', role: '管理员', status: '正常',
    createTime: at(60, 8, 0)
  }
]

const items = [
  { _id: 'i1', type: '寻物', title: '校园卡', description: '黑色校园卡，卡面有轻微划痕，丢失时装在透明卡套里。', place: '教学楼', time: at(0, 14, 30), contact: 'wxid_lin123', images: [], status: '已通过', auditReason: '', publisherId: 'u1', createTime: at(0, 14, 35) },
  { _id: 'i2', type: '寻物', title: '蓝牙耳机', description: '白色 AirPods，右耳有划痕，遗失在图书馆三楼。', place: '图书馆', time: at(1, 16, 10), contact: '13800002222', images: [], status: '已通过', auditReason: '', publisherId: 'u2', createTime: at(1, 16, 20) },
  { _id: 'i3', type: '招领', title: '折叠雨伞', description: '蓝色长柄折叠伞，拾于食堂门口伞架上。', place: '食堂', time: at(1, 12, 0), contact: 'wx_chen', images: [], status: '已通过', auditReason: '', publisherId: 'u2', createTime: at(1, 12, 30) },
  { _id: 'i4', type: '寻物', title: '双肩书包', description: '灰色耐克双肩包，内有课本若干，已找回。', place: '体育馆', time: at(4, 18, 0), contact: 'wxid_lin123', images: [], status: '已完成', auditReason: '', publisherId: 'u1', createTime: at(4, 18, 30) },
  { _id: 'i5', type: '招领', title: '房门钥匙', description: '一串钥匙，挂红色小熊挂件，拾于宿舍楼下。', place: '宿舍区', time: at(2, 20, 0), contact: '13800003333', images: [], status: '已通过', auditReason: '', publisherId: 'u3', createTime: at(2, 20, 10) },
  { _id: 'i6', type: '寻物', title: '笔记本', description: '蓝色封面笔记本，写有高数笔记。', place: '教学楼', time: at(0, 10, 0), contact: 'wx_chen', images: [], status: '待审核', auditReason: '', publisherId: 'u2', createTime: at(0, 10, 5) },
  { _id: 'i7', type: '招领', title: '保温水杯', description: '白色保温杯，信息不完整已驳回。', place: '图书馆', time: at(3, 9, 0), contact: 'wxid_lin123', images: [], status: '已驳回', auditReason: '请补充丢失/捡到具体时间与联系方式', publisherId: 'u1', createTime: at(3, 9, 10) },
  { _id: 'i8', type: '寻物', title: '学生证', description: '红色封皮学生证，名字王觅觅。', place: '食堂', time: at(2, 13, 0), contact: '13800003333', images: [], status: '已通过', auditReason: '', publisherId: 'u3', createTime: at(2, 13, 20) },
  { _id: 'i9', type: '招领', title: '充电宝', description: '黑色小米充电宝，因违规已下架。', place: '教学楼', time: at(5, 15, 0), contact: 'wx_chen', images: [], status: '已下架', auditReason: '涉嫌广告信息，已下架', publisherId: 'u2', createTime: at(5, 15, 10) },
  { _id: 'i10', type: '寻物', title: '近视眼镜', description: '黑框近视眼镜，度数较高，遗失在宿舍。', place: '宿舍区', time: at(1, 22, 0), contact: '13800004444', images: [], status: '已通过', auditReason: '', publisherId: 'u4', createTime: at(1, 22, 10) }
]

const reports = [
  { _id: 'r1', itemId: 'i9', reporterId: 'u1', reason: '疑似广告/重复发布', status: '待处理', createTime: at(4, 9, 0) }
]

const places = [
  { _id: 'p1', name: '教学楼' },
  { _id: 'p2', name: '宿舍区' },
  { _id: 'p3', name: '食堂' },
  { _id: 'p4', name: '图书馆' },
  { _id: 'p5', name: '体育馆' },
  { _id: 'p6', name: '其他' }
]

module.exports = {
  // 每次调用返回全新副本，避免多实例互相污染
  seed() {
    return {
      users: JSON.parse(JSON.stringify(users)),
      items: JSON.parse(JSON.stringify(items)),
      reports: JSON.parse(JSON.stringify(reports)),
      places: JSON.parse(JSON.stringify(places))
    }
  }
}
