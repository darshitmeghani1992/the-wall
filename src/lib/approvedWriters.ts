/**
 * Compatibility import path. Personal-Wall Settings is the single owner of
 * approved-writer reads and writes; all mutations require the initiating actor
 * and exact returned rows.
 */
export {
  addApprovedWriter,
  listApprovedWriters,
  removeApprovedWriter,
} from "./personal-wall-settings";
export type {
  ApprovedWriter,
  ApprovedWriterIdentity,
} from "./personal-wall-settings";
