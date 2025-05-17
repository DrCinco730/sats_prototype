import {
  DynamicModule,
  Global,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { Neo4jConfig } from './neo4j.types';
import { Neo4jService } from './neo4j.service';
import { NEO4J_DRIVER, NEO4J_CONFIG } from './neo4j.constants';
import * as neo4j from 'neo4j-driver';

@Global()
@Module({})
export class Neo4jModule implements OnModuleInit, OnModuleDestroy {
  private static driver: neo4j.Driver;

  async onModuleInit() {
    if (Neo4jModule.driver) {
      await Neo4jModule.driver.verifyConnectivity();
      Logger.log('Connected to Neo4j', 'Neo4jModule');
    }
  }

  async onModuleDestroy() {
    if (Neo4jModule.driver) {
      await Neo4jModule.driver.close();
    }
  }

  static forRoot(config: Neo4jConfig): DynamicModule {
    const driver = neo4j.driver(
      `${config.scheme}://${config.host}:${config.port}`,
      neo4j.auth.basic(config.username, config.password),
    );

    Neo4jModule.driver = driver;

    return {
      module: Neo4jModule,
      providers: [
        {
          provide: NEO4J_DRIVER,
          useValue: driver,
        },
        {
          provide: NEO4J_CONFIG,
          useValue: config,
        },
        Neo4jService,
      ],
      exports: [Neo4jService],
    };
  }

  static forRootAsync(options: {
    useFactory: (...args: any[]) => Promise<Neo4jConfig> | Neo4jConfig;
    inject?: any[];
  }): DynamicModule {
    const configProvider: Provider = {
      provide: NEO4J_CONFIG,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };

    const driverProvider: Provider = {
      provide: NEO4J_DRIVER,
      useFactory: async (config: Neo4jConfig) => {
        const driver = neo4j.driver(
          `${config.scheme}://${config.host}:${config.port}`,
          neo4j.auth.basic(config.username, config.password),
        );
        Neo4jModule.driver = driver;
        return driver;
      },
      inject: [NEO4J_CONFIG],
    };

    return {
      module: Neo4jModule,
      providers: [configProvider, driverProvider, Neo4jService],
      exports: [Neo4jService],
    };
  }
}
