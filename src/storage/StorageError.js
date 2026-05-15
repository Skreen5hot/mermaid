export class StorageError extends Error {
  constructor(code, detail) {
    super(code);
    this.name = 'StorageError';
    this.code = code;
    this.detail = detail;
  }
}
