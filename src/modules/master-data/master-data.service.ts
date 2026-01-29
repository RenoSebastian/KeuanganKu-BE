import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class MasterDataService {
    constructor(private prisma: PrismaService) { }

    async findAllUnits() {
        return this.prisma.unitKerja.findMany({
            orderBy: { namaUnit: 'asc' },
        });
    }

    async createUnit(dto: CreateUnitDto) {
        // Cek duplikat kode
        const existing = await this.prisma.unitKerja.findUnique({
            where: { kodeUnit: dto.kodeUnit },
        });
        if (existing) throw new BadRequestException('Kode Unit sudah ada');

        return this.prisma.unitKerja.create({
            data: dto,
        });
    }

    async updateUnit(id: string, dto: UpdateUnitDto) {
        return this.prisma.unitKerja.update({
            where: { id },
            data: dto,
        });
    }

    async deleteUnit(id: string) {
        try {
            return await this.prisma.unitKerja.delete({
                where: { id },
            });
        } catch (error) {
            if (error.code === 'P2003') {
                throw new BadRequestException('Tidak bisa menghapus Unit yang masih memiliki Pegawai');
            }
            throw error;
        }
    }
}