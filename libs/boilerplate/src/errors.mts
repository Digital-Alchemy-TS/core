export type MaybeHttpError = {
  error: string;
  message: string;
  statusCode: number;
};

export class FetchRequestError extends Error {
  error: string;
  message: string;
  statusCode: number;

  constructor({ error, message, statusCode }: MaybeHttpError) {
    super(`Fetch Request Error - ${statusCode} ${error}: ${message}`);
    this.name = this.constructor.name;
    this.error = error;
    this.message = message;
    this.statusCode = statusCode;
  }
}
