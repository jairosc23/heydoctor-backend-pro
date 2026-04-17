import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Log de arranque para Railway: confirma que TypeORM terminó de inicializar el DataSource.
 */
@Injectable()
export class DatabaseDiagnosticService implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    console.log('DB CONNECTION INIT', {
      isInitialized: this.dataSource.isInitialized,
      optionsType: this.dataSource.options.type,
    });
  }
}
