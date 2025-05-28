import { 
  Injectable, 
  ConflictException, 
  ForbiddenException,
  InternalServerErrorException,
  UnauthorizedException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private prisma: PrismaService, private jwtService: JwtService,) {}

  async validateUser(loginDto: LoginDto) {
    try {
      this.logger.debug(`Login attempt for user: ${loginDto.username}`);
      
      const user = await this.prisma.user.findFirst();
      
      if (!user) {
        this.logger.warn('No admin user found in database');
        throw new UnauthorizedException('Система не настроена');
      }

      const isValid = await bcrypt.compare(loginDto.password, user.passwordHash);
      
      if (loginDto.username !== user.username || !isValid) {
        this.logger.warn(`Invalid credentials for user: ${loginDto.username}`);
        throw new UnauthorizedException('Неверные учетные данные');
      }

      return this.generateTokens(user);
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  private generateTokens(user: any) {
    const payload = { 
      username: user.username, 
      sub: user.id,
      role: 'admin'
    };

    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: '1h',
        secret: process.env.JWT_SECRET,
      }),
      refresh_token: this.jwtService.sign(payload, {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET,
      }),
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('Пользователь не найден');
      }

      return this.generateTokens(user);
    } catch (error) {
      throw new UnauthorizedException('Недействительный токен');
    }
  }

  async createAdmin(username: string, password: string, setupKey: string) {
    try {
      this.logger.log(`Attempt to create admin user: ${username}`);
      
      // Проверка ключа настройки
      if (setupKey !== process.env.FIRST_RUN_KEY) {
        this.logger.warn(`Invalid setup key attempt: ${setupKey}`);
        throw new ForbiddenException('Неверный ключ настройки');
      }

      // Проверка существования администратора
      const existingAdmin = await this.prisma.user.findFirst();
      if (existingAdmin) {
        this.logger.warn('Attempt to create admin when already exists');
        throw new ConflictException('Администратор уже создан');
      }

      // Хеширование пароля
      const hashedPassword = await bcrypt.hash(password, 10);
      this.logger.debug('Password hashing completed');

      // Создание администратора
      const admin = await this.prisma.user.create({
        data: {
          username,
          passwordHash: hashedPassword,
        },
        select: {
          id: true,
          username: true,
          createdAt: true
        }
      });

      this.logger.log(`Admin user created: ${admin.username} (ID: ${admin.id})`);
      return admin;

    } catch (error) {
      this.logger.error(`Error creating admin: ${error.message}`, error.stack);
      
      if (error instanceof ForbiddenException || 
          error instanceof ConflictException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Ошибка при создании администратора');
    }
  }
}