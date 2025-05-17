import { Module } from '@nestjs/common';
import { UserRepository } from './repositories/user.repository';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';

@Module({
  providers: [UserRepository, UserService],
  controllers: [UserController],
})
export class UserModule {}
