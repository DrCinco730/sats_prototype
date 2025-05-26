// prototype-server/src/features/yjs/yjs.module.ts
import { Module, Global } from '@nestjs/common';
import { YjsGateway } from './yjs.gateway';
import { YjsService } from './yjs.service';

@Global()
@Module({
    providers: [YjsGateway, YjsService],
    exports: [YjsService],
})
export class YjsModule {}