export class CreateExperimentGroupDto {
  name: string;
  ratio: number;
  weights?: Record<string, any>;
  config?: Record<string, any>;
}

export class CreateExperimentDto {
  name: string;
  description?: string;
  trafficRatio: number;
  startTime: Date;
  endTime?: Date;
  groups: CreateExperimentGroupDto[];
}

export class UpdateExperimentDto {
  name?: string;
  description?: string;
  trafficRatio?: number;
  startTime?: Date;
  endTime?: Date;
  status?: string;
}
