import * as sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3';

export class Model<T> {
  constructor(db: Database, name: string, spec: ModelSpec, options?: ModelOptions) {
    this._db = db;
    this._name = name;

    for (let fieldName of Object.keys(spec)) {
      this.addField(fieldName, spec[fieldName]);
    }

    if (options && options.createTimestamp) {
      this.addField('createdAt', { typeHint: TypeHint.Date });
    }
    if (options && options.updateTimestamp) {
      this.addField('updatedAt', { typeHint: TypeHint.Date });
    }
  }

  get db(): Database { return this._db; }
  get spec(): { [name: string]: FieldSpecWrapper } { return this._spec; }
  get name(): string { return this._name; }
  get constraints(): string[] { return this._constraints; }

  getFieldSpec(fieldName: string): FieldSpec|null {
    return this._spec[fieldName] == null ? null : this._spec[fieldName].fieldSpec;
  }

  addField(fieldName: string, fieldSpec: FieldSpec): Model<T> {
    if (this._spec[fieldName] != null) {
      throw new Error(`Field with same name [${fieldName}] already exists`);
    }
    this._spec[fieldName] = new FieldSpecWrapper(fieldName, fieldSpec);
    return this;
  }

  /**
   * Get a list of primary keys.
   * In most cases, there is only one primary key, but if primary key is compound, the function will return a list containing more that one element.
   * @returns {string[]}
   */
  getPrimaryKeysNames(): string[] {
    return (Object.values(this._spec) as FieldSpecWrapper[])
        .filter(fsw => fsw.fieldSpec.primaryKey === true).map(fsw => fsw.fieldName);
  }

  /**
   * Checks if primary key of this model is compound, e.g. includes more that one column.
   */
  isPrimaryKeyCompound(): boolean {
    return this.getPrimaryKeysNames().length > 1;
  }

  updateField(fieldName: string, fieldSpec: FieldSpec): Model<T> {
    if (this._spec[fieldName] == null) {
      // add a new field instead of updating
      this.addField(fieldName, fieldSpec);
    } else {
      let oldFieldSpec = this._spec[fieldName].fieldSpec;
      for (let k of Object.keys(fieldSpec)) {
        (oldFieldSpec as any)[k] = (fieldSpec as any)[k];
      }
    }
    return this;
  }

  oneToOne(otherModel: Model<any>, relationField: string, otherRelationField?: string): Model<T> {
    return this._oneOrManyToOne(otherModel, relationField, otherRelationField, true);
  }

  manyToOne(otherModel: Model<any>, relationField: string, otherRelationField?: string): Model<T> {
    return this._oneOrManyToOne(otherModel, relationField, otherRelationField, false);
  }

  oneToMany(otherModel: Model<any>, otherRelationField: string, relationField?: string): Model<T> {
    return otherModel.oneToOne(this, otherRelationField, relationField);
  }

  manyToMany(otherModel: Model<any>, relationModel: Model<any>|string, relationField: string, otherRelationField: string): Model<T> {
    if (typeof relationModel === 'string') {
      let existingModel = this._db.getModel(relationModel);
      if (existingModel == null) {
        relationModel = this._db.define(relationModel, { });
      } else {
        relationModel = existingModel;
      }
    }

    relationModel.updateField(relationField, { typeHint: TypeHint.Integer });
    relationModel.updateField(otherRelationField, { typeHint: TypeHint.Integer });
    relationModel.addForeignKeyConstraint(relationField, this, this.getPrimaryKeysNames().join(', '));
    relationModel.addForeignKeyConstraint(otherRelationField, otherModel, otherModel.getPrimaryKeysNames().join(', '));
    relationModel.addUniqueConstraint([relationField, otherRelationField]);

    return this;
  }

  addConstraint(constr: string): Model<T> {
    this._constraints.push(constr);
    return this;
  }

  addForeignKeyConstraint(ownKey: string, foreignModel: Model<any>|string, foreignKeys: string): Model<T> {
    let modelName = typeof foreignModel === 'string' ? foreignModel : foreignModel.name;
    this.addConstraint(`FOREIGN KEY (${ownKey}) REFERENCES ${modelName}(${foreignKeys})`);
    return this;
  }

  addUniqueConstraint(fields: (string|FieldSpecWrapper)[]): Model<T> {
    let keys: string[] = fields.map(x => typeof x === 'string' ? x : x.fieldName);
    this.addConstraint(`UNIQUE(${keys.join(', ')})`);
    return this;
  }

  /** Protected area **/

  protected _db: Database;
  protected _spec: { [name: string]: FieldSpecWrapper } = {};
  protected _name: string;
  protected _constraints: string[] = [];

  protected _oneOrManyToOne(otherModel: Model<any>, relationField: string, otherRelationField: string|undefined,
                            unique: boolean) {
    if (this.getFieldSpec(relationField) == null) {
      this.addField(relationField, { typeHint: TypeHint.Integer, unique });
    } else {
      this.updateField(relationField, { unique });
    }

    if (otherRelationField == null) {
      // try to find a primary key for the other model and link to it
      let pks = otherModel.getPrimaryKeysNames();
      if (!pks.length) {
        throw new Error('Cannot find a primary key to link to model ' + otherModel.name);
      }
      otherRelationField = pks.join(', ');
    }

    this.addForeignKeyConstraint(relationField, otherModel, otherRelationField);
    return this;
  }
}

export interface ModelSpec {
  [name: string]: FieldSpec;
}

export interface FieldSpec {
  validate?: FieldValidator;
  serialize?: FieldSerializer;
  deserialize?: FieldDeserializer;
  typeHint?: TypeHint;
  allowNull?: boolean;
  defaultValue?: string|number;
  unique?: boolean;
  primaryKey?: boolean;
  collation?: string;
}

export enum TypeHint {
  Text = 'TEXT',
  Integer = 'INTEGER',
  Real = 'REAL',
  Blob = 'BLOB',
  Boolean = 'BOOLEAN',
  Date = 'DATE'
}

export type FieldValidator = (value: any) => boolean;
export type FieldSerializer = (value: any) => any;
export type FieldDeserializer = (value: any) => any;

export const CollationNoCase = 'NOCASE';

export class FieldSpecWrapper {
  constructor(public fieldName: string, public fieldSpec: FieldSpec) {

  }

  convertToDatabaseForm(value: any): any {
    if (this.fieldSpec.allowNull && value == null) {
      return null;
    }

    if (this.fieldSpec.validate != null) {
      if (!this.fieldSpec.validate(value)) {
        throw new Error(`Invalid value for a property value ${this.fieldName}`);
      }
    }

    return this.fieldSpec.serialize == null ? value : this.fieldSpec.serialize(value);
  }

  convertFromDatabaseForm(value: any): any {
    return this.fieldSpec.deserialize ? this.fieldSpec.deserialize(value) : value;
  }
}

export namespace FieldValidators {
  function ofClass(value: any, className: string): boolean {
    return Object.prototype.toString.call(value) === '[object ' + className + ']';
  }

  export const String = (value: any): boolean => typeof value == 'string' || ofClass(value, 'String');
  export const Number = (value: any): boolean => typeof value == 'number' || ofClass(value, 'Number');
  export const Boolean = (value: any): boolean => typeof value == 'boolean' || ofClass(value, 'Boolean');
  export const Date = (value: any): boolean => ofClass(value, 'Date');
  export const Empty = (value: any): boolean => value === null || value === undefined;
  export const None = () => false;
  export const Any = () => true;

  export function OneOf(...validators: FieldValidator[]): FieldValidator {
    return function(value: any): boolean {
      return validators.some(validator => validator(value));
    }
  }

  export function Both(...validators: FieldValidator[]): FieldValidator {
    return function(value: any): boolean {
      return validators.every(validator => validator(value));
    }
  }

  export function OfClass(className: string): FieldValidator {
    return function(value: any): boolean {
      return ofClass(value, className);
    }
  }
}

export interface ModelOptions {
  createTimestamp: boolean;
  updateTimestamp: boolean;
}

export interface DatabaseOpenOptions {
  shouldCreate: boolean;
}

export class Database {
  define<T>(modelName: string, modelSpec: { [name: string]: FieldSpec }, modelOptions?: ModelOptions): Model<T> {
    let model = new Model<T>(this, modelName, modelSpec, modelOptions);
    this._models.push(model);
    return model;
  }

  getModel<T>(modelName: string): Model<T>|null {
    let foundModel = this._models.find(model => model.name === modelName);
    return foundModel == null ? null : foundModel;
  }

  createSchema(): string {
    let schemaTables: string[] = [];

    for (let model of this._models) {
      let columns: string[] = [];
      let isCompoundPrimaryKey = model.isPrimaryKeyCompound();

      for (let fieldName of Object.keys(model.spec)) {
        let specWrapper = model.spec[fieldName];

        let parts: string[] = [];
        parts.push(fieldName);
        if (specWrapper.fieldSpec.typeHint != null) {
          parts.push(specWrapper.fieldSpec.typeHint);
        }
        if (specWrapper.fieldSpec.primaryKey === true && !isCompoundPrimaryKey) {
          parts.push('PRIMARY KEY');
        }
        if (specWrapper.fieldSpec.unique === true) {
          parts.push('UNIQUE');
        }
        if (specWrapper.fieldSpec.collation != null) {
          parts.push('COLLATE');
          parts.push(specWrapper.fieldSpec.collation);
        }
        if (specWrapper.fieldSpec.allowNull === false) {
          parts.push('NOT NULL');
        }
        if (specWrapper.fieldSpec.defaultValue != null) {
          parts.push('DEFAULT');
          let defValue = specWrapper.convertToDatabaseForm(specWrapper.fieldSpec.defaultValue);
          if (typeof defValue === 'string') {
            parts.push('"' + defValue + '"');
          } else {
            parts.push(defValue);
          }
        }

        columns.push(parts.join(' '));
      }

      columns.push(...model.constraints);
      if (isCompoundPrimaryKey) {
        columns.push(`PRIMARY KEY(${model.getPrimaryKeysNames().join(', ')})`);
      }
      schemaTables.push(`CREATE TABLE ${model.name}(${columns.join(', ')})`);
    }

    return schemaTables.join('; ');
  }

  async flushSchema(): Promise<void> {
    await this._db.exec(this.createSchema());
  }

  static async open(filename: string, options?: DatabaseOpenOptions): Promise<Database> {
    let db = await sqlite.open(filename, {
      mode: sqlite3.OPEN_READWRITE | (options && options.shouldCreate === false ? 0 : sqlite3.OPEN_CREATE),
      promise: Promise
    });
    await db.run('PRAGMA foreign_keys = TRUE');
    return new Database(db);
  }

  /** Protected area **/

  protected _db: sqlite.Database;
  protected _models: Model<any>[] = [];

  protected constructor(db: sqlite.Database) {
    this._db = db;
  }

  protected async _tuneConnection() {
    await this._db.run('PRAGMA foreign_keys = TRUE');
  }
}
