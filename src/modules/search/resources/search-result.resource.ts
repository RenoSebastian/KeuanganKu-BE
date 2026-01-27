// src/modules/search/resources/search-result.resource.ts

export class SearchResultResource {
    id: string;
    redirectId: string; // ID asli untuk navigasi (misal: ID User atau ID Unit)
    type: 'PERSON' | 'UNIT';
    title: string;      // Nama Orang / Nama Unit
    subtitle: string;   // Email / Kode Unit

    source: string;

    // Metadata untuk keperluan debugging atau UI badge di Frontend
    metadata: {
        source: string;     // 'MEILI' atau 'DB'
        isFuzzy: boolean;   // True jika hasil ini tebakan (bukan exact match)
    };

    constructor(data: any) {
        this.id = data.id;
        this.redirectId = data.redirectId;
        this.type = data.type;

        // Pastikan title/subtitle bersih
        this.title = data.title || 'Unknown';
        this.subtitle = data.subtitle || '';

        // Transformasi Metadata agar lebih manusiawi
        const isFromMeili = data.source === 'meilisearch';

        this.metadata = {
            source: isFromMeili ? 'MEILI_ENGINE' : 'DB_FALLBACK',
            isFuzzy: !isFromMeili, // Asumsi: jika dari DB trigram, kemungkinan besar itu fuzzy/tebakan
        };
    }

    /**
     * Static Method untuk mempermudah transformasi Array
     */
    static collect(documents: any[]): SearchResultResource[] {
        return documents.map((doc) => new SearchResultResource(doc));
    }
}