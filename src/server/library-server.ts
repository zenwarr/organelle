import {Library} from "./library";

export interface ApiResponse {
  errors: {
    id?: string,
    code?: string,
    title?: string,
    detail?: string,
  }[],
  data: any
}

export class LibraryServer {
  constructor(protected _lib: Library) {

  }

  async handle(path: string): Promise<ApiResponse> {
    throw new Error("Method not implemented");
  }

  /** Protected area **/
}
