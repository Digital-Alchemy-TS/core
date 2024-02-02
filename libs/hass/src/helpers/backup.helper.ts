export interface HomeAssistantBackup {
  date: string;
  name: string;
  path: string;
  size: number;
  slug: string;
}
export interface BackupResponse {
  backing_up: boolean;
  backups: HomeAssistantBackup[];
}
