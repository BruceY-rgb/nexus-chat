const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addAllMembersToAnnouncements() {
  try {
    console.log('🚀 开始将所有成员加入 announcements 频道...\n');

    // 1. 查找或创建 announcements 频道
    let announcementsChannel = await prisma.channel.findUnique({
      where: { name: 'announcements' }
    });

    if (!announcementsChannel) {
      console.log('📢 announcements 频道不存在，正在创建...\n');

      // 获取第一个用户作为创建者
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        throw new Error('没有找到用户数据，请先创建用户');
      }

      announcementsChannel = await prisma.channel.create({
        data: {
          name: 'announcements',
          description: '官方公告频道',
          isPrivate: false,
          createdById: firstUser.id
        }
      });

      // 将创建者加入频道
      await prisma.channelMember.create({
        data: {
          channelId: announcementsChannel.id,
          userId: firstUser.id,
          role: 'owner'
        }
      });

      console.log('✅ announcements 频道创建成功\n');
    } else {
      console.log('✅ announcements 频道已存在\n');
    }

    // 2. 获取所有 team members
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        status: 'active'
      },
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
    });

    console.log(`👥 找到 ${teamMembers.length} 个活跃团队成员\n`);

    // 3. 获取已加入的频道成员
    const existingMembers = await prisma.channelMember.findMany({
      where: {
        channelId: announcementsChannel.id
      },
      select: {
        userId: true
      }
    });

    const existingMemberIds = new Set(existingMembers.map(m => m.userId));

    // 4. 筛选出未加入的成员
    const newMembers = teamMembers.filter(
      tm => !existingMemberIds.has(tm.userId)
    );

    if (newMembers.length === 0) {
      console.log('ℹ️ 所有成员已经加入了 announcements 频道\n');
      return;
    }

    console.log(`➕ 需要加入 ${newMembers.length} 个新成员\n`);

    // 5. 批量创建频道成员记录
    const createdMembers = [];
    for (const member of newMembers) {
      try {
        const channelMember = await prisma.channelMember.create({
          data: {
            channelId: announcementsChannel.id,
            userId: member.userId,
            role: 'member'
          },
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
        });
        createdMembers.push(channelMember);
        console.log(`✅ 已加入: ${member.user.displayName} (${member.user.email})`);
      } catch (error) {
        console.error(`❌ 加入失败: ${member.user.displayName} - ${error.message}`);
      }
    }

    // 6. 统计结果
    const totalMembers = await prisma.channelMember.count({
      where: {
        channelId: announcementsChannel.id
      }
    });

    console.log('\n🎉 完成！');
    console.log(`📊 统计:`);
    console.log(`   - 新加入成员: ${createdMembers.length}`);
    console.log(`   - 频道总成员: ${totalMembers}`);

  } catch (error) {
    console.error('❌ 执行失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行脚本
addAllMembersToAnnouncements()
  .then(() => {
    console.log('\n✅ 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ 脚本执行失败:', error);
    process.exit(1);
  });
