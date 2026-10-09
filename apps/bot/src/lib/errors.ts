export function userFacingError(message: string): Error {
  const error = new Error(message);
  error.name = "UserFacingError";
  return error;
}

export function isUserFacingError(error: unknown): error is Error {
  return error instanceof Error && error.name === "UserFacingError";
}
