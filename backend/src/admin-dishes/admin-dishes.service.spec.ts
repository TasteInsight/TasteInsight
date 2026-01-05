import { Test, TestingModule } from '@nestjs/testing';
import { AdminDishesService } from './admin-dishes.service';
import { PrismaService } from '@/prisma.service';
import { EmbeddingService } from '@/recommendation/services/embedding.service';
import { EmbeddingQueueService } from '@/embedding-queue/embedding-queue.service';
import { DishStatus } from './dto/admin-dish.dto';
import {
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';

const mockPrismaService = {
    dish: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
    },
    dishUpload: {
        deleteMany: jest.fn(),
        create: jest.fn(),
    },
    window: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
    },
    review: {
        findMany: jest.fn(),
        count: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
};

const mockEmbeddingService = {
    generateDishEmbedding: jest.fn(),
};

const mockEmbeddingQueueService = {
    addToQueue: jest.fn(),
};

describe('AdminDishesService', () => {
    let service: AdminDishesService;
    let prisma: typeof mockPrismaService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AdminDishesService,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: EmbeddingService, useValue: mockEmbeddingService },
                { provide: EmbeddingQueueService, useValue: mockEmbeddingQueueService },
            ],
        }).compile();

        service = module.get<AdminDishesService>(AdminDishesService);
        prisma = mockPrismaService;
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('getAdminDishes', () => {
        const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };
        const mockDishes = [
            {
                id: 'd1',
                name: 'Dish 1',
                description: 'Description 1',
                price: 10,
                images: ['image.jpg'],
                tags: ['tag1'],
                ingredients: ['ingredient1'],
                allergens: [],
                status: 'available',
                averageRating: 4.5,
                reviewCount: 10,
                availableMealTime: ['breakfast'],
                window: {
                    id: 'w1',
                    name: 'Window 1',
                    number: '001',
                    canteen: { id: 'c1', name: 'Canteen 1' },
                    floor: { level: '1', name: 'Floor 1' },
                },
                parentDish: null,
                children: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ];

        beforeEach(() => {
            prisma.dish.findMany.mockResolvedValue(mockDishes);
            prisma.dish.count.mockResolvedValue(1);
        });

        it('should return list of dishes', async () => {
            const result = await service.getAdminDishes(
                { page: 1, pageSize: 20 },
                adminInfo as any,
            );

            expect(result.code).toBe(200);
            expect(result.data.items).toHaveLength(1);
            expect(result.data.meta.total).toBe(1);
        });

        it('should filter by keyword', async () => {
            await service.getAdminDishes({ keyword: 'test' }, adminInfo as any);

            expect(prisma.dish.findMany).toHaveBeenCalled();
        });

        it('should filter by status', async () => {
            await service.getAdminDishes({ status: DishStatus.ONLINE }, adminInfo as any);

            expect(prisma.dish.findMany).toHaveBeenCalled();
        });
    });

    describe('getAdminDishById', () => {
        const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };
        const mockDish = {
            id: 'd1',
            name: 'Dish 1',
            description: 'Description 1',
            price: 10,
            images: ['image.jpg'],
            tags: ['tag1'],
            ingredients: ['ingredient1'],
            allergens: [],
            status: DishStatus.ONLINE,
            averageRating: 4.5,
            reviewCount: 10,
            availableMealTime: ['breakfast'],
            window: {
                id: 'w1',
                name: 'Window 1',
                number: '001',
                canteenId: 'c1',
                canteen: { id: 'c1', name: 'Canteen 1' },
                floor: { level: '1', name: 'Floor 1' },
            },
            parentDish: null,
            children: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        it('should return a dish by id', async () => {
            prisma.dish.findUnique.mockResolvedValue(mockDish);

            const result = await service.getAdminDishById('d1', adminInfo as any);

            expect(result.code).toBe(200);
            expect(result.data.id).toBe('d1');
        });

        it('should throw NotFoundException if dish not found', async () => {
            prisma.dish.findUnique.mockResolvedValue(null);

            await expect(
                service.getAdminDishById('unknown', adminInfo as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if canteen admin has no access', async () => {
            const canteenAdmin = { id: 'admin-1', canteenId: 'c2', role: 'admin' };
            prisma.dish.findUnique.mockResolvedValue(mockDish);

            await expect(
                service.getAdminDishById('d1', canteenAdmin as any),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('createAdminDish', () => {
        const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };
        const createDto = {
            name: 'New Dish',
            description: 'Description',
            price: 15,
            images: ['image.jpg'],
            tags: ['tag1'],
            ingredients: ['ingredient1'],
            allergens: [],
            windowId: 'w1',
            availableMealTime: ['breakfast'],
        };

        const mockWindow = {
            id: 'w1',
            name: 'Window 1',
            number: '001',
            canteenId: 'c1',
            canteen: { id: 'c1', name: 'Canteen 1' },
            floor: { id: 'f1', level: '1', name: 'Floor 1' },
        };

        beforeEach(() => {
            prisma.window.findUnique.mockResolvedValue(mockWindow);
        });

        it('should create a new dish', async () => {
            const mockCreatedDishUpload = {
                id: 'new-id',
                name: 'New Dish',
                status: 'pending',
                canteen: mockWindow.canteen,
                window: mockWindow,
                parentDish: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            prisma.dishUpload.create.mockResolvedValue(mockCreatedDishUpload);

            const result = await service.createAdminDish(
                createDto as any,
                adminInfo as any,
            );

            expect(result.code).toBe(201);
            expect(result.data.name).toBe('New Dish');
        });

        it('should throw BadRequestException if window not found', async () => {
            prisma.window.findUnique.mockResolvedValue(null);
            prisma.window.findFirst.mockResolvedValue(null);

            await expect(
                service.createAdminDish(createDto as any, adminInfo as any),
            ).rejects.toThrow(BadRequestException);
        });

        it('should throw ForbiddenException if canteen admin creates dish for different canteen', async () => {
            const canteenAdmin = { id: 'admin-1', canteenId: 'c2', role: 'admin' };

            await expect(
                service.createAdminDish(createDto as any, canteenAdmin as any),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('updateAdminDish', () => {
        const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };
        const updateDto = {
            name: 'Updated Dish',
            price: 20,
        };

        beforeEach(() => {
            prisma.dish.findUnique.mockResolvedValue({
                id: 'd1',
                name: 'Original Dish',
                window: { canteenId: 'c1' },
            });
            prisma.dish.update.mockResolvedValue({
                id: 'd1',
                name: 'Updated Dish',
                price: 20,
                status: DishStatus.ONLINE,
                window: {
                    id: 'w1',
                    name: 'Window 1',
                    number: '001',
                    canteen: { id: 'c1', name: 'Canteen 1' },
                    floor: null,
                },
                parentDish: null,
                children: [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        });

        it('should update a dish', async () => {
            const result = await service.updateAdminDish(
                'd1',
                updateDto as any,
                adminInfo as any,
            );

            expect(result.code).toBe(200);
            expect(result.data.name).toBe('Updated Dish');
        });

        it('should throw NotFoundException if dish not found', async () => {
            prisma.dish.findUnique.mockResolvedValue(null);

            await expect(
                service.updateAdminDish('unknown', updateDto as any, adminInfo as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if canteen admin has no access', async () => {
            const canteenAdmin = { id: 'admin-1', canteenId: 'c2', role: 'admin' };

            await expect(
                service.updateAdminDish('d1', updateDto as any, canteenAdmin as any),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('deleteAdminDish', () => {
        const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };

        beforeEach(() => {
            prisma.dish.findUnique.mockResolvedValue({
                id: 'd1',
                window: { canteenId: 'c1' },
                children: [],
            });
            prisma.dishUpload.deleteMany.mockResolvedValue({});
            prisma.dish.delete.mockResolvedValue({});
        });

        it('should delete a dish', async () => {
            const result = await service.deleteAdminDish('d1', adminInfo as any);

            expect(result.code).toBe(200);
        });

        it('should throw NotFoundException if dish not found', async () => {
            prisma.dish.findUnique.mockResolvedValue(null);

            await expect(
                service.deleteAdminDish('unknown', adminInfo as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if canteen admin has no access', async () => {
            const canteenAdmin = { id: 'admin-1', canteenId: 'c2', role: 'admin' };
            prisma.dish.findUnique.mockResolvedValue({
                id: 'd1',
                window: { canteenId: 'c1' },
                children: [],
            });

            await expect(
                service.deleteAdminDish('d1', canteenAdmin as any),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('updateDishStatus', () => {
        const adminInfo = { id: 'admin-1', canteenId: null, role: 'superadmin' };

        beforeEach(() => {
            prisma.dish.findUnique.mockResolvedValue({
                id: 'd1',
                status: DishStatus.ONLINE,
                window: { canteenId: 'c1' },
            });
        });

        it('should update dish status', async () => {
            prisma.dish.update.mockResolvedValue({
                id: 'd1',
                status: DishStatus.OFFLINE,
            });

            const result = await service.updateDishStatus(
                'd1',
                DishStatus.OFFLINE,
                adminInfo as any,
            );

            expect(result.code).toBe(200);
        });

        it('should throw NotFoundException if dish not found', async () => {
            prisma.dish.findUnique.mockResolvedValue(null);

            await expect(
                service.updateDishStatus('unknown', DishStatus.ONLINE, adminInfo as any),
            ).rejects.toThrow(NotFoundException);
        });

        it('should throw ForbiddenException if canteen admin has no access', async () => {
            const canteenAdmin = { id: 'admin-1', canteenId: 'c2', role: 'admin' };

            await expect(
                service.updateDishStatus('d1', DishStatus.ONLINE, canteenAdmin as any),
            ).rejects.toThrow(ForbiddenException);
        });
    });
});
