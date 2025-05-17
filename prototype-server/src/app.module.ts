import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DiagramModule } from './features/diagram/diagram.module';
import { Neo4jModule } from './config/neo4j/neo4j.module';
import { UserModule } from './features/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    Neo4jModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        scheme: config.get<'neo4j' | 'bolt' | 'neo4j+s' | 'bolt+s'>(
          'NEO4J_CONNECTION_SCHEME',
        )!,
        host: config.get<string>('NEO4J_HOST')!,
        port: parseInt(
          config.get<string>('NEO4J_SERVICE_PORT_EXPOSE') ??
            config.get<string>('NEO4J_SERVICE_PORT_MAP')!.split(':')[0],
        ),
        username: config.get<string>('NEO4J_USERNAME')!,
        password: config.get<string>('NEO4J_PASSWORD')!,
        database: config.get<string>('NEO4J_DATABASE') ?? 'neo4j',
      }),
    }),
    DiagramModule,
    UserModule,
  ],
})
export class AppModule {}
