import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Delete,
  Param,
  Put,
} from '@nestjs/common';
import { UserService } from '../services/user.service';
import { CreateUserDto } from '../dtos/create-user.dto';
import { User } from '../entities/user.entity';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get()
  async getAll(): Promise<User[]> {
    return this.userService.list();
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<User> {
    return this.userService.findById(id);
  }

  @Get('email/:email')
  async getByEmail(@Param('email') email: string): Promise<User> {
    return this.userService.findByEmail(email);
  }

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.userService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: CreateUserDto,
  ): Promise<User> {
    return this.userService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<{ success: boolean }> {
    return { success: await this.userService.delete(id) };
  }
}
