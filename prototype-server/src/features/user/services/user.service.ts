import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dtos/create-user.dto';
import { UserRepository } from '../repositories/user.repository';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async list(): Promise<User[]> {
    return this.userRepository.list();
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    return this.userRepository.create(dto);
  }

  async update(userId: string, updates: Partial<User>): Promise<User> {
    const user = await this.userRepository.update(userId, updates);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async delete(userId: string): Promise<boolean> {
    const success = await this.userRepository.delete(userId);
    if (!success) throw new NotFoundException('User not found');
    return success;
  }
}
