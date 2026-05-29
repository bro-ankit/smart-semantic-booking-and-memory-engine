import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

function IsXorDefined(sibling: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isXorDefined',
      target: object.constructor,
      propertyName,
      constraints: [sibling],
      options: {
        message: `Exactly one of "${propertyName}" or "${sibling}" must be provided`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [siblingKey] = args.constraints as [string];
          const siblingValue = (args.object as Record<string, unknown>)[siblingKey];
          const hasSelf = value !== undefined && value !== null && value !== '';
          const hasSibling = siblingValue !== undefined && siblingValue !== null && siblingValue !== '';
          return hasSelf !== hasSibling; // XOR
        },
      },
    });
  };
}

export class IngestBookmarkDto {
  @ApiProperty({
    type: String,
    required: false,
    description: 'Raw text to ingest synchronously. Mutually exclusive with `url`.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ValidateIf((o: IngestBookmarkDto) => !o.url)
  @IsXorDefined('url')
  rawText?: string;

  @ApiProperty({
    type: String,
    required: false,
    description: 'URL to scrape and ingest asynchronously. Mutually exclusive with `rawText`.',
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @ValidateIf((o: IngestBookmarkDto) => !o.rawText)
  url?: string;
}
