import { useSyncExternalStore } from 'react'
import { getDriveState, subscribeDrive, type DriveState } from '@/data/drive/driveController'

/** Live state of the Google Drive backup: account, last backup, and whether anything needs attention. */
export function useDriveState(): DriveState {
  return useSyncExternalStore(subscribeDrive, getDriveState, getDriveState)
}
