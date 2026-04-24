import {
    Injectable,
    Logger,
    NotFoundException,
    InternalServerErrorException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { MarketSettingsService } from '../../../master-data/services/market-settings.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { FinancialQuotaService } from '../core/financial-quota.service';
import { SimulationTokenService } from '../core/simulation-token.service';
import { CreateEducationPlanDto } from '../../dto/create-education.dto';
import { CreateEducationSimulationDto } from '../../dto/create-education-simulation.dto';
import { calculateEducationPlan } from '../../utils/financial-math.util';
import { User, HealthStatus, Prisma, SchoolLevel } from '@prisma/client';

@Injectable()
export class EducationCalculatorService {
    private readonly logger = new Logger(EducationCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly marketSettingsService: MarketSettingsService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    async calculateAndSaveEducation(userId: string, dto: CreateEducationPlanDto) {
        const marketRates = await this.marketSettingsService.getSettings();
        const inflationRate = dto.inflationRate ?? Number(marketRates.inflationRate);
        const returnRate = dto.returnRate ?? 12;

        const result = calculateEducationPlan({
            ...dto,
            inflationRate,
            returnRate,
        });

        const savedData = await this.prisma.$transaction(async (tx) => {
            const plan = await tx.educationPlan.create({
                data: {
                    userId,
                    childName: dto.childName,
                    childDob: new Date(dto.childDob),
                    inflationRate,
                    returnRate,
                    method: dto.method,
                },
            });

            const stagesData = result.stagesBreakdown.map((stage) => {
                let dbLevel: SchoolLevel = stage.level;
                const levelCheck = String(stage.level).toUpperCase();
                if (levelCheck === 'KULIAH' || levelCheck === 'PT') {
                    dbLevel = SchoolLevel.S1;
                }

                return {
                    planId: plan.id,
                    level: dbLevel,
                    costType: stage.costType,
                    currentCost: stage.currentCost,
                    yearsToStart: stage.yearsToStart,
                    futureCost: stage.futureCost,
                    monthlySaving: stage.monthlySaving,
                };
            });

            await tx.educationStage.createMany({ data: stagesData });
            return plan;
        });

        return { plan: savedData, calculation: result };
    }

    async getEducationPlans(userId: string) {
        const plans = await this.prisma.educationPlan.findMany({
            where: { userId },
            include: { stages: true },
            orderBy: { createdAt: 'desc' },
        });

        return plans.map((p) => {
            const { stages, ...planData } = p;
            const totalFutureCost = stages.reduce(
                (acc, s) => acc + Number(s.futureCost),
                0,
            );
            const totalMonthlySaving = stages.reduce(
                (acc, s) => acc + Number(s.monthlySaving),
                0,
            );
            return {
                plan: planData,
                calculation: {
                    totalFutureCost,
                    monthlySaving: totalMonthlySaving,
                    stagesBreakdown: stages,
                },
            };
        });
    }

    async deleteEducationPlan(userId: string, planId: string) {
        const plan = await this.prisma.educationPlan.findFirst({
            where: { id: planId, userId },
        });

        if (!plan) {
            throw new NotFoundException('Rencana pendidikan tidak ditemukan');
        }

        return this.prisma.educationPlan.delete({ where: { id: planId } });
    }

    async simulateAgentEducation(user: User, dto: CreateEducationSimulationDto) {
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId, 'EDUCATION');

        try {
            let grandTotalFutureCost = 0;
            let grandTotalMonthlySaving = 0;

            if (dto.childrenPlans) {
                dto.childrenPlans.forEach((child) => {
                    child.stages.forEach((stage) => {
                        grandTotalFutureCost += stage.calculatedFutureValue || 0;
                        grandTotalMonthlySaving += stage.calculatedMonthlySaving || 0;
                    });
                });
            }

            const outputResult = {
                totalFutureCost: grandTotalFutureCost,
                totalMonthlySaving: grandTotalMonthlySaving,
                childrenPlans: dto.childrenPlans,
                clientName: dto.clientName,
            };

            const clientAge = dto.clientDob ? this.calculateAge(dto.clientDob) : null;

            const log = await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity,
                    clientJob: dto.clientJob || '-',
                    totalIncome: grandTotalFutureCost,
                    calculatedSurplus: grandTotalMonthlySaving,
                    healthScore: 100,
                    status: HealthStatus.SEHAT,
                    moduleType: 'EDUCATION',
                    inputPayload: JSON.parse(
                        JSON.stringify(dto),
                    ) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(outputResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'EDUCATION',
                    simulationId: log.id,
                },
                data: dto,
            });

            const cleanName = dto.clientName.replace(/[^a-zA-Z0-9]/g, '_');

            return {
                status: 'success',
                data: outputResult,
                simulationId: log.id,
                mgcToken: mgcToken,
                filename: `Education_Plan_${cleanName}_${Date.now()}.pdf`,
            };

        } catch (error: any) {
            this.logger.error(
                `Education Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi pendidikan.',
            );
        }
    }

    private calculateAge(dobString: string): number {
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    }

    async downloadEducationPdfById(simulationId: string, user: User) {
        const log = await this.prisma.simulationLog.findFirst({
            where: {
                id: simulationId,
                agentId: user.id
            }
        });

        if (!log) {
            throw new NotFoundException('Data simulasi tidak ditemukan');
        }

        // [CRITICAL FIX] 
        // Menggabungkan Payload Input & Output agar Generator punya data kalkulasi
        const originalInput = log.inputPayload as unknown as CreateEducationSimulationDto;
        const outputResult = log.outputResult as any;

        // Injeksi hasil agregat kembali ke DTO agar bisa dirender
        const payloadToGenerate = {
            ...originalInput,
            aggregatedResult: outputResult
        };

        return this.pdfService.generateEducationSimulationPdf(payloadToGenerate as any, user);
    }
}