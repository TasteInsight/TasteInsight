import { Module } from '@nestjs/common';
import { AllergensService } from './allergens.service';

@Module({ providers: [AllergensService], exports: [AllergensService] })
export class AllergensModule {}
