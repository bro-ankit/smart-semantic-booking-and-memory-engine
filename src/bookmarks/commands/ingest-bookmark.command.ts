import type { IngestBookmarkDto } from '../dto/ingest-bookmark.dto';

export class IngestBookmarkCommand {
  constructor(public readonly dto: IngestBookmarkDto) {}
}
