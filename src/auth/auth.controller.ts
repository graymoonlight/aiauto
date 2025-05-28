import { Body, Controller, Post, UseGuards, HttpCode, Get} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200) // Явно указываем код ответа
  async login(@Body() loginDto: LoginDto) {
    return this.authService.validateUser(loginDto);
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(200)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refresh_token);
  }

  @Post('setup-admin')
  @HttpCode(201) // 201 Created для успешного создания
  async setupAdmin(@Body() createAdminDto: CreateAdminDto) {
    return this.authService.createAdmin(
      createAdminDto.username,
      createAdminDto.password,
      createAdminDto.setupKey
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('protected')
  getProtectedData() {
    return { message: 'Защищенные данные' };
  }
}