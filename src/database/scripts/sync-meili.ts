import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';

async function syncMeilisearch() {
  const prisma = new PrismaClient();
  
  // Inisialisasi client Meilisearch secara manual untuk script ini
  const meiliClient = new MeiliSearch({
    host: 'http://127.0.0.1:7700',
    apiKey: 'RAHASIA_KITA_123', // Pastikan sesuai dengan Master Key Meilisearch kamu
  });

  console.log('--- Starting Initial Data Sync to Meilisearch ---');

  try {
    // 1. Ambil semua data user dari database
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        unitKerjaId: true,
      },
    });

    const mappedUsers = allUsers.map(user => ({
      id: user.id,
      name: user.fullName, // Map fullName ke name untuk index search
      email: user.email,
      role: user.role,
      unitKerja: user.unitKerjaId
    }));

    console.log(`Found ${allUsers.length} users in database.`);

    // 2. Persiapkan Index
    const index = meiliClient.index('users');

    // 3. Konfigurasi Index (Logical Step: Mengatur field apa saja yang bisa dicari)
    await index.updateSettings({
      searchableAttributes: ['name', 'email', 'unitKerja'],
      filterableAttributes: ['role', 'unitKerja'],
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    });
    console.log('Index settings updated (Typo tolerance enabled).');

    // 4. Bulk Upload
    const task = await index.addDocuments(mappedUsers);
    
    console.log(`Successfully queued bulk upload task. Task UID: ${task.taskUid}`);
    console.log('Check Meilisearch dashboard or wait a few seconds for processing.');

  } catch (error) {
    console.error('Error during sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Jalankan fungsi
syncMeilisearch();