const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getChannelInfo() {
  try {
    const channel = await prisma.channel.findUnique({
      where: { name: 'announcements' },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
                realName: true,
                avatarUrl: true,
                isOnline: true
              }
            }
          }
        }
      }
    });

    if (!channel) {
      console.log('❌ announcements 频道不存在');
      return;
    }

    console.log('📢 频道信息:');
    console.log(`   ID: ${channel.id}`);
    console.log(`   名称: ${channel.name}`);
    console.log(`   描述: ${channel.description || '无'}`);
    console.log(`   成员数: ${channel.members.length}\n`);

    console.log('👥 频道成员列表:');
    channel.members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.user.displayName} (${member.user.email})`);
      console.log(`   角色: ${member.role}`);
      console.log(`   加入时间: ${member.joinedAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 获取频道信息失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getChannelInfo();
