import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { SubmitQuizDto } from '../dto/submit-quiz.dto';
import { UpsertQuizDto } from '../dto/upsert-quiz.dto';
import { EducationReadService } from './education-read.service';
import { EducationModuleStatus, EducationProgressStatus } from '@prisma/client';
import {
    PublicQuizSerializer,
    QuizSubmissionResultSerializer,
} from '../serialization/quiz.serializer';

import { EDUCATION_CONSTANTS } from '../../../common/constants/education.constant';

@Injectable()
export class QuizEngineService {
    private readonly logger = new Logger(QuizEngineService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly readService: EducationReadService,
    ) { }

    // --- 1. UPSERT QUIZ (WIPE & REPLACE DENGAN GARBAGE COLLECTION LOGIC) ---

    async upsertQuiz(moduleId: string, dto: UpsertQuizDto) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Validasi Modul
            const module = await tx.educationModule.findUnique({
                where: { id: moduleId },
                include: {
                    quiz: {
                        include: {
                            questions: {
                                include: { options: true }
                            }
                        }
                    }
                }
            });

            if (!module) {
                throw new NotFoundException(`Education Module with ID ${moduleId} not found`);
            }

            const orphanedImages: string[] = [];
            const existingQuiz = module.quiz;

            // 2. Diffing Algorithm untuk Garbage Collection
            if (existingQuiz) {
                const oldImages = new Set<string>();
                const newImages = new Set<string>();

                // Kumpulkan semua state gambar lama
                existingQuiz.questions.forEach(q => {
                    if (q.imageUrl) oldImages.add(q.imageUrl);
                    q.options.forEach(o => {
                        if (o.imageUrl) oldImages.add(o.imageUrl);
                    });
                });

                // Kumpulkan semua state gambar baru dari DTO
                dto.questions.forEach(q => {
                    if (q.imageUrl) newImages.add(q.imageUrl);
                    q.options.forEach(o => {
                        if (o.imageUrl) newImages.add(o.imageUrl);
                    });
                });

                // Kalkulasi Orphaned Images (Ada di lama, tidak ada di baru)
                oldImages.forEach(img => {
                    if (!newImages.has(img)) {
                        orphanedImages.push(img);
                    }
                });

                // Wipe Data Lama (Hapus relasi Questions, Options akan terhapus via Cascade)
                await tx.quizQuestion.deleteMany({
                    where: { quizId: existingQuiz.id }
                });
            }

            // 3. Upsert Quiz & Rekonstruksi Relasi
            const upsertedQuiz = await tx.quiz.upsert({
                where: { moduleId: moduleId },
                update: {
                    passingScore: dto.passingScore,
                    timeLimit: dto.timeLimit,
                    maxAttempts: dto.maxAttempts,
                    description: dto.description,
                    questions: {
                        create: dto.questions.map(q => ({
                            questionText: q.questionText,
                            type: q.type,
                            orderIndex: q.orderIndex,
                            imageUrl: q.imageUrl,
                            explanation: q.explanation,
                            points: q.points,
                            options: {
                                create: q.options.map(o => ({
                                    optionText: o.optionText,
                                    isCorrect: o.isCorrect,
                                    imageUrl: o.imageUrl,
                                    orderIndex: o.orderIndex,
                                }))
                            }
                        }))
                    }
                },
                create: {
                    moduleId: moduleId,
                    passingScore: dto.passingScore,
                    timeLimit: dto.timeLimit,
                    maxAttempts: dto.maxAttempts,
                    description: dto.description,
                    questions: {
                        create: dto.questions.map(q => ({
                            questionText: q.questionText,
                            type: q.type,
                            orderIndex: q.orderIndex,
                            imageUrl: q.imageUrl,
                            explanation: q.explanation,
                            points: q.points,
                            options: {
                                create: q.options.map(o => ({
                                    optionText: o.optionText,
                                    isCorrect: o.isCorrect,
                                    imageUrl: o.imageUrl,
                                    orderIndex: o.orderIndex,
                                }))
                            }
                        }))
                    }
                }
            });

            this.logger.log(`Quiz Upserted for Module: ${moduleId}. Orphaned Images found: ${orphanedImages.length}`);

            // Mengembalikan Data dan Metadata GC agar bisa di-dispatch oleh Controller
            return {
                quiz: upsertedQuiz,
                garbageUrls: orphanedImages
            };
        });
    }

    // --- 2. GET QUIZ ---

    async getQuizByModuleSlug(userId: string, moduleSlug: string) {
        const module = await this.prisma.educationModule.findUnique({
            where: { slug: moduleSlug },
            include: {
                quiz: {
                    include: {
                        questions: {
                            orderBy: { orderIndex: 'asc' },
                            include: {
                                options: { select: { id: true, optionText: true, isCorrect: false, imageUrl: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!module || !module.quiz) return null;

        if (
            module.status !== EducationModuleStatus.PUBLISHED ||
            (module.publishedAt && module.publishedAt > new Date())
        ) {
            throw new ForbiddenException(EDUCATION_CONSTANTS.ERRORS.NOT_PUBLISHED);
        }

        await this.readService.markQuizStart(userId, module.id);

        return {
            ...module.quiz,
            moduleId: module.id,
        };
    }

    // --- 3. SUBMIT & GRADING ---

    async submitQuiz(userId: string, moduleSlug: string, dto: SubmitQuizDto) {
        return this.prisma.$transaction(async (tx) => {

            const module = await tx.educationModule.findUnique({
                where: { slug: moduleSlug },
                include: {
                    quiz: {
                        include: {
                            questions: {
                                include: { options: true },
                            },
                        },
                    },
                },
            });

            if (!module || !module.quiz) {
                throw new NotFoundException(EDUCATION_CONSTANTS.ERRORS.QUIZ_NOT_FOUND);
            }

            const quiz = module.quiz;

            const progress = await tx.userEducationProgress.findUnique({
                where: { userId_moduleId: { userId, moduleId: module.id } },
            });

            // Guard 1: Session Valid?
            if (!progress || !progress.startedAt) {
                throw new BadRequestException(EDUCATION_CONSTANTS.ERRORS.SESSION_INVALID);
            }

            // Guard 2: Time Window Check (Anti-Cheat)
            if (quiz.timeLimit > 0) {
                const now = new Date();
                const startedAt = new Date(progress.startedAt);
                const timeElapsedMinutes = (now.getTime() - startedAt.getTime()) / 60000;

                // [CLEANUP] Menggunakan Constant Buffer
                const bufferMinutes = EDUCATION_CONSTANTS.QUIZ.SUBMISSION_BUFFER_MINUTES;

                if (timeElapsedMinutes > (quiz.timeLimit + bufferMinutes)) {
                    this.logger.warn(`User ${userId} timeout. Time: ${timeElapsedMinutes.toFixed(2)}m`);
                    throw new ForbiddenException(EDUCATION_CONSTANTS.ERRORS.TIMEOUT);
                }
            }

            // Guard 3: Max Attempts Check
            if (progress.quizAttempts >= quiz.maxAttempts) {
                throw new ForbiddenException(EDUCATION_CONSTANTS.ERRORS.MAX_ATTEMPTS);
            }

            // 3. Grading Logic
            let correctCount = 0;
            const totalQuestions = quiz.questions.length;
            const questionMap = new Map(quiz.questions.map((q) => [q.id, q]));

            for (const answer of dto.answers) {
                const question = questionMap.get(answer.questionId);
                if (!question) continue;

                const correctOption = question.options.find((o) => o.isCorrect);
                if (correctOption && correctOption.id === answer.selectedOptionId) {
                    correctCount++;
                }
            }

            // 4. Score Calculation
            const finalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
            const isPassed = finalScore >= quiz.passingScore;

            // 5. Update Database
            const newAttemptCount = progress.quizAttempts + 1;
            const currentBestScore = progress.quizScore ?? 0;
            const scoreToSave = Math.max(finalScore, currentBestScore);

            const newStatus = isPassed ? EducationProgressStatus.COMPLETED : progress.status;
            const newCompletedAt = (isPassed && !progress.isPassed) ? new Date() : progress.completedAt;

            await tx.userEducationProgress.update({
                where: { userId_moduleId: { userId, moduleId: module.id } },
                data: {
                    quizAttempts: newAttemptCount,
                    quizScore: scoreToSave,
                    isPassed: isPassed || progress.isPassed,
                    lastQuizDate: new Date(),
                    status: newStatus,
                    completedAt: newCompletedAt,
                },
            });

            this.logger.log(
                `Quiz Commit: User ${userId} | Module ${moduleSlug} | Score ${finalScore}`
            );

            return new QuizSubmissionResultSerializer({
                score: finalScore,
                isPassed,
                attemptsUsed: newAttemptCount,
                maxAttempts: quiz.maxAttempts,
                submittedAt: new Date(),
                // [CLEANUP] Menggunakan Message Generator dari Constant
                message: isPassed
                    ? EDUCATION_CONSTANTS.MESSAGES.PASSED
                    : EDUCATION_CONSTANTS.MESSAGES.FAILED(finalScore, quiz.passingScore),
            });
        });
    }
}