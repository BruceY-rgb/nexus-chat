#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDMConversations() {
  console.log('🔍 Checking DM Conversations...\n');

  const dmConversations = await prisma.dMConversation.findMany({
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  console.log(`📊 Total DM Conversations: ${dmConversations.length}\n`);

  // 检查成员数量
  const memberCountStats = new Map<number, number>();
  const invalidConversations: any[] = [];

  for (const dm of dmConversations) {
    const count = dm.members.length;
    memberCountStats.set(count, (memberCountStats.get(count) || 0) + 1);

    if (count !== 2) {
      invalidConversations.push({
        id: dm.id,
        memberCount: count,
        members: dm.members.map(m => m.user.displayName),
      });
    }
  }

  console.log('📈 Member Count Distribution:');
  for (const [count, freq] of memberCountStats) {
    console.log(`  ${count} members: ${freq} conversations`);
  }

  if (invalidConversations.length > 0) {
    console.log(`\n❌ Found ${invalidConversations.length} invalid conversations (not exactly 2 members):`);
    for (const inv of invalidConversations.slice(0, 10)) {
      console.log(`  - ID: ${inv.id}`);
      console.log(`    Members (${inv.memberCount}): ${inv.members.join(', ')}`);
    }
  } else {
    console.log('\n✅ All DM conversations have exactly 2 members');
  }

  // 检查重复的对话（相同的用户对）
  console.log('\n🔍 Checking for duplicate conversations (same user pairs)...');
  const userPairs = new Set<string>();

  for (const dm of dmConversations) {
    const userIds = dm.members.map(m => m.user.id).sort();
    const pairKey = `${userIds[0]}-${userIds[1]}`;

    if (userPairs.has(pairKey)) {
      console.log(`⚠️  Duplicate pair found: ${pairKey}`);
    } else {
      userPairs.add(pairKey);
    }
  }

  console.log(`\n✅ Unique user pairs: ${userPairs.size}`);

  // 查找有最多成员的对话
  const maxMembers = Math.max(...Array.from(memberCountStats.keys()));
  if (maxMembers > 2) {
    console.log(`\n⚠️  Max members in a conversation: ${maxMembers}`);
    const maxMemberDMs = dmConversations.filter(dm => dm.members.length === maxMembers);
    for (const dm of maxMemberDMs.slice(0, 3)) {
      console.log(`  - DM ${dm.id}: ${dm.members.length} members`);
      dm.members.forEach(m => console.log(`    - ${m.user.displayName}`));
    }
  }

  // 显示一些正常的DM对话示例
  console.log('\n📝 Sample DM conversations (2 members):');
  const validDMs = dmConversations.filter(dm => dm.members.length === 2).slice(0, 5);
  for (const dm of validDMs) {
    console.log(`  - DM ${dm.id}:`);
    dm.members.forEach(m => console.log(`    - ${m.user.displayName} (${m.user.email})`));
  }

  await prisma.$disconnect();
}

checkDMConversations().catch(console.error);
