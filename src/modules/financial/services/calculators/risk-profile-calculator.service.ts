import {
    Injectable,
    Logger,
    InternalServerErrorException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../../prisma/prisma.service';
import { PdfGeneratorService } from '../../services/pdf-generator.service';
import { FinancialQuotaService } from '../core/financial-quota.service';
import { SimulationTokenService } from '../core/simulation-token.service';
import { User, HealthStatus, Prisma } from '@prisma/client';

// DTOs
import { CalculateRiskProfileDto } from '../../dto/calculate-risk-profile.dto';
import { CreateRiskProfileSimulationDto } from '../../dto/create-risk-profile-simulation.dto';
import { RiskProfileResponseDto } from '../../dto/risk-profile-response.dto';

// Math Utils
import { calculateRiskProfileAnalysis } from '../../utils/financial-math.util';

@Injectable()
export class RiskProfileCalculatorService {
    private readonly logger = new Logger(RiskProfileCalculatorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly pdfService: PdfGeneratorService,
        private readonly quotaService: FinancialQuotaService,
        private readonly tokenService: SimulationTokenService,
    ) { }

    /**
     * [PUBLIC/STATELESS] Hitung Profil Risiko (Tanpa Save)
     */
    calculateRiskProfile(dto: CalculateRiskProfileDto): RiskProfileResponseDto {
        const analysis = calculateRiskProfileAnalysis(dto.answers as any);
        return {
            calculatedAt: new Date().toISOString(),
            clientName: dto.clientName,
            totalScore: analysis.totalScore,
            riskProfile: analysis.profile,
            riskDescription: analysis.description,
            allocation: analysis.allocation,
        };
    }

    /**
     * [AGENT] Simulasi Profil Risiko (Dengan Save, PDF, Token)
     */
    async simulateAgentRiskProfile(
        user: User,
        dto: CreateRiskProfileSimulationDto,
    ) {
        // 1. Validasi Quota
        await this.quotaService.validateAndDeductQuota(user.id, dto.sessionId);

        try {
            // 2. Kalkulasi
            const analysisResult = calculateRiskProfileAnalysis(dto.answers as any);
            const clientAge = this.calculateAge(dto.clientDob);

            // 3. Log Activity
            await this.prisma.simulationLog.create({
                data: {
                    agentId: user.id,
                    clientName: dto.clientName,
                    clientAge: clientAge,
                    clientCity: dto.clientCity || '-',
                    clientJob: dto.clientJob || '-',
                    totalIncome: 0,
                    calculatedSurplus: 0,
                    healthScore: analysisResult.totalScore,
                    status: HealthStatus.SEHAT,
                    financialRatios: {
                        profile: analysisResult.profile,
                        allocation: analysisResult.allocation,
                    } as unknown as Prisma.InputJsonValue,
                    moduleType: 'RISK_PROFILE',
                    inputPayload: JSON.parse(
                        JSON.stringify(dto),
                    ) as Prisma.InputJsonValue,
                    outputResult: JSON.parse(
                        JSON.stringify(analysisResult),
                    ) as Prisma.InputJsonValue,
                    sessionId: dto.sessionId,
                },
            });

            // 4. Generate PDF Response DTO
            const riskProfileResponse: RiskProfileResponseDto = {
                calculatedAt: new Date().toISOString(),
                clientName: dto.clientName,
                clientDob: dto.clientDob,
                totalScore: analysisResult.totalScore,
                riskProfile: analysisResult.profile,
                riskDescription: analysisResult.description,
                allocation: analysisResult.allocation,
            };

            const pdfBuffer =
                await this.pdfService.generateRiskProfileSimulationPdfBuffer(
                    dto,
                    riskProfileResponse,
                    user,
                );

            // 5. Generate Token
            const mgcToken = this.tokenService.generateMgcToken({
                meta: {
                    version: '1.0',
                    generatedAt: new Date().toISOString(),
                    agentId: user.id,
                    module: 'RISK_PROFILE',
                },
                client: {
                    name: dto.clientName,
                    dob: dto.clientDob,
                    city: dto.clientCity,
                    job: dto.clientJob,
                    phone: dto.clientPhone,
                },
                financial: {
                    answers: dto.answers,
                },
                result: analysisResult,
            });

            const cleanName = dto.clientName.replace(/[^a-zA-Z0-9]/g, '_');
            return {
                pdfBuffer,
                mgcToken,
                filename: `Risk_Profile_${cleanName}_${Date.now()}.pdf`,
            };
        } catch (error: any) {
            this.logger.error(
                `Risk Profile Simulation Error: ${error.message}`,
                error.stack,
            );
            if (error instanceof ForbiddenException) throw error;
            throw new InternalServerErrorException(
                'Gagal memproses simulasi Profil Risiko.',
            );
        }
    }

    private calculateAge(dobString: string): number {
        const dob = new Date(dobString);
        const diffMs = Date.now() - dob.getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    }
}