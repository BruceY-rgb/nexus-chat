const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addAllMembersToAnnouncements() {
  try {
    console.log('Starting to add all members to announcements channel...\n');

    // 1. Find or create announcements channel
    let announcementsChannel = await prisma.channel.findUnique({
      where: { name: 'announcements' }
    });

    if (!announcementsChannel) {
      console.log('announcements channel does not exist, creating...\n');

      // Get first user as creator
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        throw new Error('No user data found, please create users first');
      }

      announcementsChannel = await prisma.channel.create({
        data: {
          name: 'announcements',
          description: 'Official Announcements',
          isPrivate: false,
          createdById: firstUser.id
        }
      });

      // Add creator to channel
      await prisma.channelMember.create({
        data: {
          channelId: announcementsChannel.id,
          userId: firstUser.id,
          role: 'owner'
        }
      });

      console.log('announcements channel created successfully\n');
    } else {
      console.log('announcements channel already exists\n');
    }

    // 2. Get all team members
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

    console.log(`Found ${teamMembers.length} active team members\n`);

    // 3. Get existing channel members
    const existingMembers = await prisma.channelMember.findMany({
      where: {
        channelId: announcementsChannel.id
      },
      select: {
        userId: true
      }
    });

    const existingMemberIds = new Set(existingMembers.map(m => m.userId));

    // 4. Filter out members not yet joined
    const newMembers = teamMembers.filter(
      tm => !existingMemberIds.has(tm.userId)
    );

    if (newMembers.length === 0) {
      console.log('All members have already joined the announcements channel\n');
      return;
    }

    console.log(`Need to add ${newMembers.length} new members\n`);

    // 5. Batch create channel member records
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
        console.log(`Added: ${member.user.displayName} (${member.user.email})`);
      } catch (error) {
        console.error(`Failed to add: ${member.user.displayName} - ${error.message}`);
      }
    }

    // 6. Statistics
    const totalMembers = await prisma.channelMember.count({
      where: {
        channelId: announcementsChannel.id
      }
    });

    console.log('\nDone!');
    console.log(`Statistics:`);
    console.log(`   - New members added: ${createdMembers.length}`);
    console.log(`   - Total channel members: ${totalMembers}`);

  } catch (error) {
    console.error('Execution failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run script
addAllMembersToAnnouncements()
  .then(() => {
    console.log('\nScript execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript execution failed:', error);
    process.exit(1);
  });
