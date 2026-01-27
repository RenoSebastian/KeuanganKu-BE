export class SearchResultResource {
  id: string;
  name: string;
  email: string;
  role: string;
  unitKerja: string;
  displayTitle: string; // Gabungan Nama & Unit untuk UI
  matchedHighlight: string; // Mengambil hasil highlight typo dari Meilisearch

  constructor(hit: any) {
    this.id = hit.id;
    this.name = hit.name;
    this.email = hit.email;
    this.role = hit.role;
    this.unitKerja = hit.unitKerja || 'N/A';
    
    // Logic untuk mempermudah Frontend menampilkan informasi utama
    this.displayTitle = `${hit.name} (${this.unitKerja})`;

    // Meilisearch mengirimkan highlight dalam properti _formatted
    // Kita ambil nama yang sudah ada tag <em>-nya jika tersedia
    this.matchedHighlight = hit._formatted?.name || hit.name;
  }

  /**
   * Static method untuk mentransformasi data dalam bentuk Array (Collection)
   */
  static collect(hits: any[]): SearchResultResource[] {
    return hits.map((hit) => new SearchResultResource(hit));
  }
}