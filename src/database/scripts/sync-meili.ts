import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';

// Definisi Tipe Dokumen Meilisearch agar Type-Safe
interface SearchDocument {
  id: string;          // ID Unik Meilisearch (gabungan type + uuid)
  title: string;       // Nama Orang atau Nama Unit
  subtitle: string;    // Email atau Kode Unit
  type: 'PERSON' | 'UNIT';
  redirectId: string;  // UUID asli untuk routing di Frontend
  tag: string;         // Filter tambahan (Role atau Organization)
}

async function syncMeilisearch() {
  const prisma = new PrismaClient();
  
  // Konfigurasi Client Meilisearch
  // Pastikan Host dan Key sesuai dengan environment Anda
  const meiliClient = new MeiliSearch({
    host: process.env.MEILI_HOST || 'http://127.0.0.1:7700',
    apiKey: process.env.MEILI_MASTER_KEY || 'MASTER_KEY_ANDA', 
  });

  console.log('--- 🚀 Starting OmniSearch Synchronization ---');

  try {
    // 1. Fetch Data User (Hanya yang aktif/relevan)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        unitKerjaId: true,
      },
    });

    // 2. Fetch Data Unit Kerja
    const units = await prisma.unitKerja.findMany({
      select: {
        id: true,
        namaUnit: true,
        kodeUnit: true,
      },
    });

    console.log(`📊 Found ${users.length} Users and ${units.length} Units in database.`);

    // 3. Transformasi Data (Mapping ke Standar 'SearchDocument')
    
    // Mapping Users
    const mappedUsers: SearchDocument[] = users.map((user) => ({
      id: `user_${user.id}`,          // Prefix agar ID tidak bentrok
      title: user.fullName,           // Standardisasi display utama
      subtitle: user.email,           // Standardisasi display sekunder
      type: 'PERSON',                 // Discriminator untuk Frontend
      redirectId: user.id,            // ID asli untuk URL navigation
      tag: user.role,                 // Facet untuk filtering (misal: cari direktur saja)
    }));

    // Mapping Units
    const mappedUnits: SearchDocument[] = units.map((unit) => ({
      id: `unit_${unit.id}`,
      title: unit.namaUnit,
      subtitle: unit.kodeUnit,
      type: 'UNIT',
      redirectId: unit.id,
      tag: 'ORGANIZATION',
    }));

    // Gabungkan Dataset
    const dataset = [...mappedUsers, ...mappedUnits];

    // 4. Setup Index 'global_search'
    const index = meiliClient.index('global_search');

    // Reset index jika perlu (opsional, hati-hati di production)
    // await index.deleteAllDocuments(); 

    // 5. Update Settings (Logic Configuration)
    console.log('⚙️ Updating Index Settings...');
    await index.updateSettings({
      // Field yang bisa dicari user via ketikan
      searchableAttributes: [
        'title', 
        'subtitle'
      ],
      
      // Field yang bisa dipakai untuk filtering (WHERE ...)
      filterableAttributes: [
        'type', 
        'tag'
      ],

      // Konfigurasi Typo Tolerance (PENTING untuk kasus "Reno" vs "Reo")
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 3,  // Izinkan 1 typo untuk kata >= 3 huruf (Reno -> Reo: OK)
          twoTypos: 8  // Izinkan 2 typo untuk kata >= 8 huruf
        },
      },

      // Rules Ranking (Relevansi)
      rankingRules: [
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ],
    });

    // 6. Upload Data
    console.log(`📤 Uploading ${dataset.length} documents...`);
    const task = await index.addDocuments(dataset);
    
    console.log(`✅ Sync Queued! Task UID: ${task.taskUid}`);
    console.log(`👉 Index Name: 'global_search'`);
    console.log('   Tunggu beberapa detik sebelum mencoba search di Frontend.');

  } catch (error) {
    console.error('❌ Error during sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Eksekusi Script
syncMeilisearch();