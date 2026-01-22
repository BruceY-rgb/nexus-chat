import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('Available models:');
const models = Object.keys(prisma).filter(k => !k.startsWith('$') && !k.startsWith('_'));
console.log(models);

console.log('\nChecking dmConversationMember:', prisma.dMConversationMember ? 'exists' : 'undefined');
console.log('Checking dmConversation:', prisma.dMConversation ? 'exists' : 'undefined');
