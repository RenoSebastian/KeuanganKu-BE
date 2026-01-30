import { PrismaClient, Role } from '@prisma/client';
import { DEFAULT_PASSWORD, hashPassword } from './helpers';

export const seedUsers = async (prisma: PrismaClient) => {
    console.log('🌱 Seeding 02_users...');

    // 1. Prepare Dependencies
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    // Fetch Unit Kerja IDs (Required for Relation)
    const unitIT = await prisma.unitKerja.findUnique({ where: { kodeUnit: 'IT-01' } });
    const unitBOD = await prisma.unitKerja.findUnique({ where: { kodeUnit: 'BOD-01' } });

    if (!unitIT || !unitBOD) {
        throw new Error('❌ Critical Error: Unit Kerja not found. Run 01_master_data first.');
    }

    // 2. Create Director (Role: DIRECTOR)
    await prisma.user.upsert({
        where: { email: 'director@keuanganku.com' },
        update: {},
        create: {
            fullName: 'Bapak Direktur Utama',
            email: 'director@keuanganku.com',
            nip: 'DIR-001',
            passwordHash,
            role: Role.DIRECTOR,
            unitKerjaId: unitBOD.id,
            dateOfBirth: new Date('1975-05-20'),
            dependentCount: 2,
        },
    });

    // 3. [NEW] Create Admin (Role: ADMIN)
    // Admin ditempatkan di Unit IT sebagai System Administrator
    await prisma.user.upsert({
        where: { email: 'admin@keuanganku.com' },
        update: {},
        create: {
            fullName: 'System Administrator',
            email: 'admin@keuanganku.com',
            nip: 'ADM-001',
            passwordHash,
            role: Role.ADMIN,
            unitKerjaId: unitIT.id,
            dateOfBirth: new Date('1990-08-17'),
            dependentCount: 0,
        },
    });

    // 4. Create 10 Simulation Users (Batch Loop)
    // Logic: Loop efisien, upsert berdasarkan NIP untuk mencegah duplikasi
    const usersPayload = Array.from({ length: 10 }).map((_, index) => {
        const idNum = index + 1;
        return {
            fullName: `User Simulasi ${idNum}`,
            email: `user${idNum}@simulasi.com`,
            nip: `EMP-SIM-${idNum.toString().padStart(3, '0')}`,
            passwordHash,
            role: Role.USER,
            unitKerjaId: unitIT.id,
            dateOfBirth: new Date('1995-01-01'), // Generasi Milenial/Z
            dependentCount: idNum % 3, // Variasi tanggungan 0-2
        };
    });

    // Execute in Transaction
    await prisma.$transaction(
        usersPayload.map((user) =>
            prisma.user.upsert({
                where: { nip: user.nip },
                update: {},
                create: user,
            })
        )
    );

    console.log(`✅ 1 Director, 1 Admin & ${usersPayload.length} Users Seeded.`);
};