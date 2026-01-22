// TeamMember 接口定义 - 完全模仿 Slack 用户属性
export interface TeamMember {
  id: string;
  name: string;        // 全名
  displayName: string; // 昵称
  avatarUrl: string;   // 头像链接
  status: 'online' | 'offline' | 'away'; // 用户状态
  role: 'admin' | 'member'; // 角色权限
  email: string;       // 邮箱地址
}

// Mock 数据 - 包含 5 个虚构成员，其中一个是当前登录用户
export const mockTeamMembers: TeamMember[] = [
  {
    id: '1',
    name: '张伟',
    displayName: 'zhangwei',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
    status: 'online',
    role: 'admin',
    email: 'zhangwei@example.com'
  },
  {
    id: '2',
    name: '李娜',
    displayName: 'lina',
    avatarUrl: 'https://i.pravatar.cc/150?img=2',
    status: 'online',
    role: 'member',
    email: 'lina@example.com'
  },
  {
    id: '3',
    name: '王强',
    displayName: 'wangqiang',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
    status: 'away',
    role: 'member',
    email: 'wangqiang@example.com'
  },
  {
    id: '4',
    name: '刘芳',
    displayName: 'liufang',
    avatarUrl: 'https://i.pravatar.cc/150?img=4',
    status: 'offline',
    role: 'member',
    email: 'liufang@example.com'
  },
  {
    id: '5',
    name: '陈明',
    displayName: 'chenming',
    avatarUrl: 'https://i.pravatar.cc/150?img=5',
    status: 'online',
    role: 'admin',
    email: 'chenming@example.com'
  }
];

// 获取当前登录用户
export const getCurrentUser = (): TeamMember => {
  // 默认返回 ID 为 '1' 的用户作为当前登录用户
  return mockTeamMembers.find(member => member.id === '1')!;
};

// 可切换当前用户的辅助函数
export const setCurrentUser = (userId: string): TeamMember | null => {
  const user = mockTeamMembers.find(member => member.id === userId);
  if (user) {
    (user as any).isCurrentUser = true;
  }
  return user || null;
};
