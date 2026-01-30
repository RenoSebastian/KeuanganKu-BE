import { ApiProperty } from '@nestjs/swagger';

export class TableStatItemDto {
    @ApiProperty({ example: 'FinancialCheckup' })
    tableName: string;

    @ApiProperty({ example: 150000, description: 'Estimasi jumlah baris (Live Tuples)' })
    rowCount: number;

    @ApiProperty({ example: 104857600, description: 'Ukuran total dalam Bytes (Data + Index)' })
    totalBytes: number;

    @ApiProperty({ example: '100 MB', description: 'Ukuran terformat human-readable' })
    formattedSize: string;

    @ApiProperty({ example: 52428800, description: 'Ukuran index saja dalam Bytes' })
    indexBytes: number;
}

export class DatabaseStatsResponseDto {
    @ApiProperty({ type: [TableStatItemDto] })
    tables: TableStatItemDto[];

    @ApiProperty({ example: 524288000, description: 'Total ukuran seluruh database dalam Bytes' })
    totalDatabaseSize: number;

    @ApiProperty({ example: '500 MB' })
    formattedTotalSize: string;
}