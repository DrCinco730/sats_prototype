// prototype-server/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule} from '@nestjs/config';
import { DiagramModule } from './features/diagram/diagram.module';
import { UserModule } from './features/user/user.module';
import { Neo4jGlobalModule } from "./utility/neogma_provider";
import { YjsModule } from './features/yjs/yjs.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    Neo4jGlobalModule,
    DiagramModule,
    UserModule,
    YjsModule,
  ],
})
export class AppModule {}