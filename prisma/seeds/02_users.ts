// File: prisma/seeds/02_users.ts
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedUsers(prisma: PrismaClient) {
    console.log('   👥 Seeding Initial Users...');

    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Super Admin
    const adminEmail = 'hello@keuanganku.id';
    await prisma.user.upsert({
        where: { email: adminEmail },
        update: {},
        create: {
            email: adminEmail,
            fullName: 'Super Admin',
            passwordHash,
            role: Role.ADMIN,
            quota: 9999, // Admin unlimited
            phoneNumber: '6281111111111',
        },
    });

    // 2. Demo Agent
    const agentEmail = 'agent@demo.com';
    const agent = await prisma.user.upsert({
        where: { email: agentEmail },
        update: {},
        create: {
            email: agentEmail,
            fullName: 'Budi Agent',
            passwordHash,
            role: Role.USER,
            companyName: 'Prudential Life',
            agentLevel: 'Senior',
            phoneNumber: '6282222222222',
            quota: 0, // Nanti dapat dari seed subscription atau logic create user
        },
    });

    // Init Usage & Ledger untuk Demo Agent (Manual Init untuk Seed)
    const usageCheck = await prisma.userUsage.findUnique({ where: { userId: agent.id } });
    if (!usageCheck) {
        await prisma.userUsage.create({
            data: { userId: agent.id, simulationQuota: 3, totalUsed: 0 }
        });
    }

    console.log('      ✅ Admin & Demo Agent Created');
}