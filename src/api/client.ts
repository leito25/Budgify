import { SignedOutError } from "../auth/session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  /** A token that is valid now, or a SignedOutError. */
  getToken: () => Promise<string>;
  /** Called when the server refuses the sign-in, so the app can sign out. */
  onSignedOut: () => void;
}

async function failureMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const detail =
    typeof body === "object" && body !== null && "detail" in body
      ? (body as { detail: unknown }).detail
      : null;
  return typeof detail === "string"
    ? detail
    : `The server answered ${response.status}.`;
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.token();
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError("The server could not be reached.", null);
    }
    if (response.status === 401) {
      this.options.onSignedOut();
      throw new ApiError("Sign in required.", 401);
    }
    if (!response.ok)
      throw new ApiError(await failureMessage(response), response.status);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private async token(): Promise<string> {
    try {
      return await this.options.getToken();
    } catch (error) {
      if (error instanceof SignedOutError) {
        this.options.onSignedOut();
        throw new ApiError("Sign in required.", 401);
      }
      throw new ApiError("The server could not be reached.", null);
    }
  }
}
