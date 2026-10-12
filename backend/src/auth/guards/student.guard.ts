import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { isCurrentStudent } from '../student-status';

@Injectable()
export class StudentGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request.user?.sub || request.user.type !== 'user') {
      throw new UnauthorizedException();
    }
    const verification = await this.prisma.studentVerification.findUnique({
      where: { userId: request.user.sub },
    });
    if (!isCurrentStudent(verification)) {
      throw new ForbiddenException({
        code: 'STUDENT_VERIFICATION_REQUIRED',
        message: '请先完成有效的在校学生认证',
      });
    }
    return true;
  }
}
