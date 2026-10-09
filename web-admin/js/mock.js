// Web 后台 Mock 数据（与小程序一致；useMock=true 时使用）
window.MOCK = {
  users: [
    { _id: 'admin', nickname: '管理员', realName: '系统管理员', studentId: '0000', college: '校学生处', phone: '00000000000', cardImage: '', authStatus: '已认证', authReason: '', role: '管理员', status: '正常', createTime: '2026-07-28 08:00' },
    { _id: 'u1', nickname: '林小满', realName: '林小满', studentId: '2023010123', college: '计算机学院 软件2301', phone: '13800001111', cardImage: '', authStatus: '已认证', authReason: '', role: '学生', status: '正常', createTime: '2026-08-28 09:00' },
    { _id: 'u2', nickname: '陈拾意', realName: '陈拾意', studentId: '2023010456', college: '外国语学院 英语2302', phone: '13800002222', cardImage: '', authStatus: '已认证', authReason: '', role: '学生', status: '正常', createTime: '2026-08-30 10:00' },
    { _id: 'u3', nickname: '王觅觅', realName: '王觅觅', studentId: '2023010789', college: '数学学院 统计2301', phone: '13800003333', cardImage: '', authStatus: '审核中', authReason: '', role: '学生', status: '正常', createTime: '2026-09-21 11:00' },
    { _id: 'u4', nickname: '赵缺缺', realName: '赵缺缺', studentId: '2023010900', college: '物理学院 物理2303', phone: '13800004444', cardImage: '', authStatus: '已驳回', authReason: '校园卡照片不清晰，请重新上传', role: '学生', status: '正常', createTime: '2026-09-23 14:00' }
  ],
  items: [
    { _id: 'i1', type: '寻物', title: '校园卡', description: '黑色校园卡，卡面有轻微划痕。', place: '教学楼A栋', time: '2026-09-26 14:30', contact: 'wxid_lin123', images: [], status: '已通过', auditReason: '', publisherId: 'u1', createTime: '2026-09-26 14:35' },
    { _id: 'i2', type: '寻物', title: '蓝牙耳机', description: '白色 AirPods，右耳有划痕。', place: '图书馆', time: '2026-09-25 16:10', contact: '13800002222', images: [], status: '已通过', auditReason: '', publisherId: 'u2', createTime: '2026-09-25 16:20' },
    { _id: 'i3', type: '招领', title: '折叠雨伞', description: '蓝色长柄折叠伞。', place: '食堂', time: '2026-09-25 12:00', contact: 'wx_chen', images: [], status: '已通过', auditReason: '', publisherId: 'u2', createTime: '2026-09-25 12:30' },
    { _id: 'i4', type: '寻物', title: '双肩书包', description: '灰色耐克双肩包，已找回。', place: '运动场', time: '2026-09-22 18:00', contact: 'wxid_lin123', images: [], status: '已完成', auditReason: '', publisherId: 'u1', createTime: '2026-09-22 18:30' },
    { _id: 'i5', type: '招领', title: '房门钥匙', description: '一串钥匙，挂红色小熊挂件。', place: '宿舍', time: '2026-09-24 20:00', contact: '13800003333', images: [], status: '已通过', auditReason: '', publisherId: 'u3', createTime: '2026-09-24 20:10' },
    { _id: 'i6', type: '寻物', title: '笔记本', description: '蓝色封面笔记本。', place: '教学楼B栋', time: '2026-09-26 10:00', contact: 'wx_chen', images: [], status: '待审核', auditReason: '', publisherId: 'u2', createTime: '2026-09-26 10:05' },
    { _id: 'i7', type: '招领', title: '保温水杯', description: '白色保温杯。', place: '图书馆', time: '2026-09-23 09:00', contact: 'wxid_lin123', images: [], status: '已驳回', auditReason: '请补充丢失/捡到具体时间与联系方式', publisherId: 'u1', createTime: '2026-09-23 09:10' },
    { _id: 'i8', type: '寻物', title: '学生证', description: '红色封皮学生证。', place: '食堂', time: '2026-09-24 13:00', contact: '13800003333', images: [], status: '已通过', auditReason: '', publisherId: 'u3', createTime: '2026-09-24 13:20' },
    { _id: 'i9', type: '招领', title: '充电宝', description: '黑色小米充电宝。', place: '教学楼A栋', time: '2026-09-21 15:00', contact: 'wx_chen', images: [], status: '已下架', auditReason: '涉嫌广告信息，已下架', publisherId: 'u2', createTime: '2026-09-21 15:10' },
    { _id: 'i10', type: '寻物', title: '近视眼镜', description: '黑框近视眼镜。', place: '宿舍', time: '2026-09-25 22:00', contact: '13800004444', images: [], status: '已通过', auditReason: '', publisherId: 'u4', createTime: '2026-09-25 22:10' }
  ],
  reports: [
    { _id: 'r1', itemId: 'i9', reporterId: 'u1', reason: '疑似广告/重复发布', status: '待处理', createTime: '2026-09-22 09:00' }
  ],
  places: [
    { _id: 'p1', name: '教学楼' },
    { _id: 'p2', name: '宿舍' },
    { _id: 'p3', name: '食堂' },
    { _id: 'p4', name: '图书馆' },
    { _id: 'p5', name: '运动场' },
    { _id: 'p6', name: '其他' }
  ]
}
