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
      console.log('announcements channel does not exist');
      return;
    }

    console.log('Channel Information:');
    console.log(`   ID: ${channel.id}`);
    console.log(`   Name: ${channel.name}`);
    console.log(`   Description: ${channel.description || 'none'}`);
    console.log(`   Member count: ${channel.members.length}\n`);

    console.log('Channel Member List:');
    channel.members.forEach((member, index) => {
      console.log(`${index + 1}. ${member.user.displayName} (${member.user.email})`);
      console.log(`   Role: ${member.role}`);
      console.log(`   Joined at: ${member.joinedAt}`);
      console.log('');
    });

  } catch (error) {
    console.error('Failed to get channel information:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getChannelInfo();
