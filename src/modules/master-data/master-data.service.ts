import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class MasterDataService {
    constructor(private prisma: PrismaService) { }

    async findAllUnits() {
        // [FIX] unitKerja -> agency, namaUnit -> name
        return this.prisma.agency.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async createUnit(dto: CreateUnitDto) {
        // [FIX] Cek duplikat berdasarkan 'code' bukan 'kodeUnit'
        const existing = await this.prisma.agency.findUnique({
            where: { code: dto.kodeUnit },
        });
        if (existing) throw new BadRequestException('Kode Agency sudah ada');

        // [FIX] Mapping DTO (legacy) ke Schema Baru (Agency)
        return this.prisma.agency.create({
            data: {
                code: dto.kodeUnit,
                name: dto.namaUnit,
                address: dto.alamat || null // Asumsi ada field alamat di DTO
            },
        });
    }

    async updateUnit(id: string, dto: UpdateUnitDto) {
        // [FIX] Update ke tabel agency
        return this.prisma.agency.update({
            where: { id },
            data: {
                code: dto.kodeUnit,
                name: dto.namaUnit,
                // address: dto.alamat 
            },
        });
    }

    async deleteUnit(id: string) {
        try {
            // [FIX] Hapus dari agency
            return await this.prisma.agency.delete({
                where: { id },
            });
        } catch (error: any) {
            if (error.code === 'P2003') {
                throw new BadRequestException('Tidak bisa menghapus Agency yang masih memiliki User/Agent');
            }
            throw error;
        }
    }
}