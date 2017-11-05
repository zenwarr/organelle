export class DatabaseClient {
  constructor(protected _url: string) {

  }

  get url(): string { return this._url; }

  static async connect(url: string): Promise<DatabaseClient> {
    throw new Error("Method not implemented");
  }
}
