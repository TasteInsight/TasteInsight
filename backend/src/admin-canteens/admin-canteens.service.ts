import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { CreateCanteenDto } from './dto/create-canteen.dto';
import { UpdateCanteenDto } from './dto/update-canteen.dto';
import {
  CanteenListResponseDto,
  CanteenResponseDto,
  CanteenDto,
} from './dto/canteen-response.dto';

@Injectable()
export class AdminCanteensService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    pageSize: number = 20,
  ): Promise<CanteenListResponseDto> {
    const skip = (page - 1) * pageSize;

    const [total, canteens] = await Promise.all([
      this.prisma.canteen.count(),
      this.prisma.canteen.findMany({
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          windows: true,
          floors: true,
        },
      }),
    ]);

    const items: CanteenDto[] = canteens.map((canteen) => ({
      ...canteen,
      openingHours: canteen.openingHours,
      floors: canteen.floors,
      windows: canteen.windows,
    }));

    return {
      code: 200,
      message: 'success',
      data: {
        items,
        meta: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      },
    };
  }

  async create(
    createCanteenDto: CreateCanteenDto,
  ): Promise<CanteenResponseDto> {
    const { windows, floors, ...canteenData } = createCanteenDto;

    // Note: floors are currently ignored as there is no field in Canteen model

    const canteen = await this.prisma.canteen.create({
      data: {
        ...canteenData,
        openingHours: canteenData.openingHours as any,
        windows: {
          create: windows.map((w) => ({
            name: w.name,
            number: w.number ?? '',
            position: w.position,
            description: w.description,
            tags: w.tags || [],
          })),
        },
        floors: {
          create: floors.map((f) => ({
            level: f.level,
            name: f.name,
          })),
        },
      },
      include: {
        windows: true,
        floors: true,
      },
    });

    return {
      code: 200,
      message: 'success',
      data: {
        ...canteen,
        openingHours: canteen.openingHours,
        floors: canteen.floors,
        windows: canteen.windows,
      },
    };
  }

  async update(
    id: string,
    updateCanteenDto: UpdateCanteenDto,
  ): Promise<CanteenResponseDto> {
    const { windows, floors, ...canteenData }: { windows?: any[], floors?: any[], name?: string, description?: string, position?: string, images?: string[], openingHours?: any } = updateCanteenDto;

    const existingCanteen = await this.prisma.canteen.findUnique({
      where: { id },
    });
    if (!existingCanteen) {
      throw new NotFoundException('食堂不存在');
    }

    // Update basic info
    const updatedFields: any = {};
    if (canteenData.name !== undefined) updatedFields.name = canteenData.name;
    if (canteenData.description !== undefined) updatedFields.description = canteenData.description;
    if (canteenData.position !== undefined) updatedFields.position = canteenData.position;
    if (canteenData.images !== undefined) updatedFields.images = canteenData.images;
    if (canteenData.openingHours !== undefined) updatedFields.openingHours = canteenData.openingHours as any;

    await this.prisma.canteen.update({
      where: { id },
      data: updatedFields,
    });

    // If canteen name was updated, sync dish canteenName
    if (canteenData.name) {
      await this.prisma.dish.updateMany({
        where: { canteenId: id },
        data: { canteenName: canteenData.name },
      });
    }

    // Update windows if provided
    if (windows) {
      // 1. Get existing windows
      const existingWindows = await this.prisma.window.findMany({
        where: { canteenId: id },
      });
      const existingWindowIds = existingWindows.map((w) => w.id);

      // 2. Identify windows to create, update, and delete
      const windowsToUpdate = windows.filter(
        (w) => w.id && existingWindowIds.includes(w.id),
      );
      const windowsToCreate = windows.filter((w) => !w.id);
      // Note: Windows with IDs not in DB are treated as invalid or ignored, or could be created if we ignore the ID.
      // Here we assume if ID is provided but not found, it's an error or we ignore it.

      const providedIds = windows
        .map((w) => w.id)
        .filter((id) => !!id) as string[];
      const windowsToDelete = existingWindowIds.filter(
        (id) => !providedIds.includes(id),
      );

      // 3. Prepare operations for transaction
      const operations: any[] = [];

      // Delete removed windows
      if (windowsToDelete.length > 0) {
        operations.push(
          this.prisma.window.deleteMany({
            where: {
              id: { in: windowsToDelete },
              canteenId: id, // Safety check
            },
          })
        );
      }

      // Update existing windows and collect sync operations
      const dishSyncs: any[] = [];
      for (const window of windowsToUpdate) {
        const existingWindow = existingWindows.find(w => w.id === window.id);
        const updatedData: any = {
          name: window.name,
          position: window.position,
          description: window.description,
          tags: window.tags,
        };
        if (window.number !== undefined) updatedData.number = window.number;

        operations.push(
          this.prisma.window.update({
            where: { id: window.id },
            data: updatedData,
          })
        );

        // If window name or number changed, sync dish windowName and windowNumber
        if (existingWindow && (existingWindow.name !== window.name || 
            (window.number !== undefined && existingWindow.number !== window.number))) {
          dishSyncs.push(
            this.prisma.dish.updateMany({
              where: { windowId: window.id },
              data: {
                windowName: window.name,
                ...(window.number !== undefined ? { windowNumber: window.number } : {})
              },
            })
          );
        }
      }

      // Create new windows
      if (windowsToCreate.length > 0) {
        operations.push(
          this.prisma.window.createMany({
            data: windowsToCreate.map((w) => ({
              canteenId: id,
              name: w.name,
              number: w.number ?? '',
              position: w.position,
              description: w.description,
              tags: w.tags || [],
            })),
          })
        );
      }

      // Execute all operations in transaction
      await this.prisma.$transaction([...operations, ...dishSyncs]);
    }

    // Update floors if provided
    if (floors) {
      // 1. Get existing floors
      const existingFloors = await this.prisma.floor.findMany({
        where: { canteenId: id },
      });
      const existingFloorIds = existingFloors.map((f) => f.id);

      // 2. Identify floors to create, update, and delete
      const floorsToUpdate = floors.filter(
        (f) => f.id && existingFloorIds.includes(f.id),
      );
      const floorsToCreate = floors.filter((f) => !f.id);

      const providedIds = floors
        .map((f) => f.id)
        .filter((id) => !!id) as string[];
      const floorsToDelete = existingFloorIds.filter(
        (id) => !providedIds.includes(id),
      );

      // 3. Prepare operations for transaction
      const operations: any[] = [];

      // Delete removed floors
      if (floorsToDelete.length > 0) {
        operations.push(
          this.prisma.floor.deleteMany({
            where: {
              id: { in: floorsToDelete },
              canteenId: id,
            },
          })
        );
      }

      // Update existing floors and collect sync operations
      const dishSyncs: any[] = [];
      for (const floor of floorsToUpdate) {
        const existingFloor = existingFloors.find(f => f.id === floor.id);
        operations.push(
          this.prisma.floor.update({
            where: { id: floor.id },
            data: {
              level: floor.level,
              name: floor.name,
            },
          })
        );

        // If floor name or level changed, sync dish floorName and floorLevel
        if (existingFloor && (existingFloor.name !== floor.name || existingFloor.level !== floor.level)) {
          dishSyncs.push(
            this.prisma.dish.updateMany({
              where: { floorId: floor.id },
              data: {
                floorName: floor.name,
                floorLevel: floor.level,
              },
            })
          );
        }
      }

      // Create new floors
      if (floorsToCreate.length > 0) {
        operations.push(
          this.prisma.floor.createMany({
            data: floorsToCreate.map((f) => ({
              canteenId: id,
              level: f.level,
              name: f.name,
            })),
          })
        );
      }

      // Execute all operations in transaction
      await this.prisma.$transaction([...operations, ...dishSyncs]);
    }

    const updatedCanteen = await this.prisma.canteen.findUnique({
      where: { id },
      include: { windows: true, floors: true },
    });

    return {
      code: 200,
      message: 'success',
      data: {
        ...updatedCanteen!,
        openingHours: updatedCanteen!.openingHours,
        floors: updatedCanteen!.floors,
        windows: updatedCanteen!.windows,
      },
    };
  }

  async remove(id: string): Promise<any> {
    const canteen = await this.prisma.canteen.findUnique({ where: { id } });
    if (!canteen) {
      throw new NotFoundException('食堂不存在');
    }

    await this.prisma.canteen.delete({ where: { id } });

    return {
      code: 200,
      message: 'success',
      data: null,
    };
  }
}
