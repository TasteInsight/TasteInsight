import { PartialType } from '@nestjs/swagger';
import { CreateCanteenDto } from './create-canteen.dto';

export class UpdateCanteenDto extends PartialType(CreateCanteenDto) {}
