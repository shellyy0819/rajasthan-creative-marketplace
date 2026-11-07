export class ApiError extends Error {
  /** `field` names the input a 400/422 belongs to, so the form can show the message next to it. */
  constructor(public status: number, message: string, public field?: string) { super(message); }
}
