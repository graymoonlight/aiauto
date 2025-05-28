import { IsString, IsNotEmpty, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 20)
  username: string;

  @IsString()
  @IsNotEmpty()
  @Length(8, 30)
  password: string;
}