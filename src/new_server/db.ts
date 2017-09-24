import * as sqlite from 'sqlite';
import * as sqlite3 from 'sqlite3';

/**
 * Base class for all ORM instances
 */
export class DatabaseInstance<T> {
  constructor(db: Database, model: Model<T>) {
    this.$d = {
      db: db,
      model: model,
      fields: new Map(),
      created: false,
      rowId: null
    };
  }

  /**
   * Database this instance is linked to.
   * @returns {Database}
   */
  get $db(): Database { return this.$d.db }

  /**
   * Model of this instance
   * @returns {Model<T>}
   */
  get $model(): Model<T> { return this.$d.model; }

  /**
   * Synchronizes the instance object with database.
   * If object was created using 'Model.build', new row will be inserted into database.
   * If object was already created, it is going to be updated.
   * @param {string[]} updateFields List of fields to updated.
   * Used only when updating the instance.
   * If omitted, all fields are going to be updated.
   * If specified, only these fields are going to be updated in database.
   * @returns {Promise<void>} Fulfilled when done
   */
  async $sync(updateFields?: string[]): Promise<void> {
    if (this.$created) {
      return this.$db.updateInstance(this, updateFields);
    } else {
      await this.$db.createInstance(this);
      this.$d.created = true;
    }
  }

  /**
   * Removes the instance from database.
   * @returns {Promise<void>}
   */
  async $remove(): Promise<void> {
    await this.$db.removeInstance(this);
    this.$d.created = false;
    this.$d.rowId = null;
  }

  /**
   * Whether the instance has been flushed into a database.
   * If object has already been removed, this value is false.
   */
  get $created(): boolean { return this.$d.created; }

  /**
   * Implicit row id.
   * If instance is not flushed into a database, this value is null.
   * If object has already been removed, this value is null.
   * Otherwise, it has some unique value.
   */
  get $rowId(): any { return this.$d.rowId; }
  set $rowId(value: any) { this.$d.rowId = value; }

  /**
   * Map of all fields of the instance.
   * @returns {Map<string, any>} Map of <field name>: <field value>
   */
  get $fields(): Map<string, any> {
    return this.$d.fields;
  }

  /** Protected area **/

  protected $d: {
    db: Database,
    model: Model<T>,
    fields: Map<string, any>,
    created: boolean,
    rowId: any
  };
}

/**
 * ORM model class.
 */
export class Model<T> {
  /**
   * You should not create Model instances yourself.
   * Use Database.define for it.
   * @param {Database} db Database for the model
   * @param {string} name Model name (used as a table name)
   * @param {ModelSpec} spec Fields specifications
   * @param {ModelOptions} options Model options
   */
  constructor(db: Database, name: string, spec: ModelSpec, options?: ModelOptions) {
    this._db = db;
    this._name = name;
    this._options = Object.assign({}, {
      createTimestamp: false,
      updateTimestamp: false
    } as ModelOptions, options);

    for (let fieldName of Object.keys(spec)) {
      this.addField(fieldName, spec[fieldName]);
    }

    if (this.options.createTimestamp) {
      this.addField('createdAt', {
        typeHint: TypeHint.Date,
        newGenerate: given => given == null ? new Date() : given
      });
    }

    if (this.options.updateTimestamp) {
      this.addField('updatedAt', { typeHint: TypeHint.Date });
    }
  }

  /**
   * Database for the model
   * @returns {Database}
   */
  get db(): Database { return this._db; }

  /**
   * Field specifications for the model.
   * Note that this function returns not the specs you've provided to define, but wrappers for them.
   * Use FieldSpecWrapper.fieldSpec to access raw field specification.
   * @returns {{[p: string]: FieldSpecWrapper}} Map of field names to field specification wrappers.
   */
  get spec(): { [name: string]: FieldSpecWrapper } { return this._spec; }

  /**
   * Model name
   * @returns {string} Model name
   */
  get name(): string { return this._name; }

  /**
   * Model options that were used to define the model
   * @returns {ModelOptions} Model options
   */
  get options(): ModelOptions { return this._options; }

  /**
   * Defined model constraints.
   * @returns {string[]} List of constrants
   */
  get constraints(): string[] { return this._constraints; }

  /**
   * Returns raw field spec for the field with given name.
   * @param {string} fieldName Name of the field you are interested in
   * @returns {FieldSpec} Raw field spec (the one you've provided to Database.define)
   */
  getFieldSpec(fieldName: string): FieldSpec|null {
    return this._spec[fieldName] == null ? null : this._spec[fieldName].fieldSpec;
  }

  /**
   * Returns field spec wrapper for the field with given name.
   * @param {string} name Name of the field you are interested in
   * @returns {FieldSpecWrapper} Field spec
   */
  getFieldWrapper(name: string): FieldSpecWrapper|null {
    return this._spec[name] || null;
  }

  /**
   * Adds a new field to the model.
   * @param {string} fieldName Name of the field to add.
   * @param {FieldSpec} fieldSpec Field specification
   * @returns {Model<T>} This model
   */
  addField(fieldName: string, fieldSpec: FieldSpec): Model<T> {
    if (this._spec[fieldName] != null) {
      throw new Error(`Field with same name [${fieldName}] already exists`);
    }
    this._spec[fieldName] = new FieldSpecWrapper(fieldName, fieldSpec);
    return this;
  }

  /**
   * Returns name of the primary key field.
   * If no primary key field defined, implicit sqlite primary key column name is returned.
   * If two or more fields are marked as primary, it is undefined which one is going to be returned (because this class does not support compound primary keys).
   * @returns {string|null} Primary key field name
   */
  getPrimaryKeyName(): string {
    let primary = (Object.values(this._spec) as FieldSpecWrapper[]).find(fsw => fsw.fieldSpec.primaryKey === true);
    return primary == null ? 'rowid' : primary.fieldName;
  }

  /**
   * If no field with fieldName exists for the model, new field will be added, just like addField would do.
   * If the field already exists, it changes its spec properties to ones provided in fieldSpec.
   * The properties not mentioned in fieldSpec argument are not changed.
   * @param {string} fieldName Name of the field to update.
   * @param {FieldSpec} fieldSpec New field specification or spec properties to update
   * @returns {Model<T>} This model
   */
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

  /**
   * Creates a new one-to-one relation with another model.
   * Relation is implemented via adding a new field to this model which references an instance of another model.
   * @param {Model<any>} otherModel A model to add the relation to
   * @param {string} relationField Field which be used to create the relation.
   * This field will store foreign key value.
   * If the field does not exists, it will be created.
   * To make the relation really one-to-one, field will become unique.
   * @param {string} otherRelationField A field in another model to be used as a foreign key.
   * You can omit this option, and the primary key of the other model will be used.
   * Primary key of the other model should be already registered on the other model for it to work.
   * @returns {Model<T>} This model
   */
  oneToOne(otherModel: Model<any>, relationField: string, otherRelationField?: string): Model<T> {
    return this._oneOrManyToOne(otherModel, relationField, otherRelationField, true);
  }

  /**
   * Creates a new many-to-one relation with another model.
   * It works just like one-to-one relation, but relation field is not unique.
   * @param {Model<any>} otherModel A model to add the relation to
   * @param {string} relationField A field to be used to create the relation.
   * @param {string} otherRelationField A field in another model to be used as a foreign key.
   * @returns {Model<T>} This model
   */
  manyToOne(otherModel: Model<any>, relationField: string, otherRelationField?: string): Model<T> {
    return this._oneOrManyToOne(otherModel, relationField, otherRelationField, false);
  }

  /**
   * Creates a new one-to-many relation with another model.
   * Relation is implemented like it would be one-to-many relation on otherModel with this model.
   * So only otherModel is modified, not the current one.
   * @param {Model<any>} otherModel A model to add the relation to
   * @param {string} otherRelationField A field to be used to store foreign key.
   * This field will be added to otherModel, not this one.
   * @param {string} relationField A field which value will be used as a foreign key.
   * This should be a field of this model.
   * @returns {Model<T>} This model
   */
  oneToMany(otherModel: Model<any>, otherRelationField: string, relationField?: string): Model<T> {
    return otherModel.oneToOne(this, otherRelationField, relationField);
  }

  /**
   * Creates a new many-to-many relation with another model.
   * This relation is implemented by creating a relation table which stores pairs of foreign keys to both models.
   * @param {Model<any>} otherModel A model to add the relation to
   * @param {Model<any> | string} relationModel A model which will be used as a relation model.
   * If no model with the provided name exist, new one will be created.
   * You can use an existing model to make the relation table have other fields.
   * @param {string} relationField Name of a field on relationModel which will be used to store foreign key for this model
   * @param {string} otherRelationField Name of a field on relationModel which will be used to store foreign key for other model
   * @returns {Model<T>} This model
   */
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
    relationModel.addForeignKeyConstraint(relationField, this, this.getPrimaryKeyName() as string);
    relationModel.addForeignKeyConstraint(otherRelationField, otherModel, otherModel.getPrimaryKeyName() as string);
    relationModel.addUniqueConstraint([relationField, otherRelationField]);

    return this;
  }

  /**
   * Adds a new constraint to the model
   * @param {string} constr Constraint text
   * @returns {Model<T>} This model
   */
  addConstraint(constr: string): Model<T> {
    this._constraints.push(constr);
    return this;
  }

  /**
   * A shortcut for addConstraint that adds a new foreign key constraint.
   * @param {string} ownKey Name of a field on the current model
   * @param {Model<any> | string} foreignModel Name of other model
   * @param {string} foreignKeys Key (or keys, separated by commas) of other model
   * @returns {Model<T>} This model
   */
  addForeignKeyConstraint(ownKey: string, foreignModel: Model<any>|string, foreignKeys: string): Model<T> {
    let modelName = typeof foreignModel === 'string' ? foreignModel : foreignModel.name;
    this.addConstraint(`FOREIGN KEY (${ownKey}) REFERENCES ${modelName}(${foreignKeys})`);
    return this;
  }

  /**
   * A shortcut for addConstraint that adds a new UNIQUE constraint.
   * This function is most useful when you want to make a compound unique constraint.
   * Do not use this function to make a single field unique.
   * Set 'unique' flag on the field's spec to make it unique.
   * @param {(string | FieldSpecWrapper)[]} fields List of keys that should be unique.
   * @returns {Model<T>} This model
   */
  addUniqueConstraint(fields: (string|FieldSpecWrapper)[]): Model<T> {
    let keys: string[] = fields.map(x => typeof x === 'string' ? x : x.fieldName);
    this.addConstraint(`UNIQUE(${keys.join(', ')})`);
    return this;
  }

  /**
   * Creates a new instance for the model.
   * Does not store anything into the database.
   * You should call $create on the created instance to write changes.
   * @param {{[name: string]: any}} template Properties of the new instance.
   * @returns {T & DatabaseInstance<T>} New instance.
   * This instance has all properties that correspond to the fields of the model, plus DatabaseInstance methods that start with $.
   */
  build(template: { [name: string]: any }): T & DatabaseInstance<T> {
    let inst = new DatabaseInstance(this._db, this);
    for (let field of Object.values(this._spec)) {
      let given = template[field.fieldName];
      if (given == null && field.fieldSpec.newGenerate != null) {
        given = field.fieldSpec.newGenerate(given);
      }
      if (given == null) {
        given = null;
      }
      inst.$fields.set(field.fieldName, given);
    }

    return new Proxy(inst, {
      get: function(target: DatabaseInstance<T>, name: string, receiver: any): any {
        if (!(typeof name === 'string') || name.startsWith('$') || Reflect.has(target, name)) {
          return Reflect.get(target, name, target);
        } else if (target.$fields.has(name)) {
          return target.$fields.get(name);
        } else {
          throw new Error(`There is no field named [${name}]`);
        }
      },
      set: function(target: DatabaseInstance<T>, name: string, value: any, receiver: any): boolean {
        if (!(typeof name === 'string') || name.startsWith('$') || Reflect.has(target, name)) {
          return Reflect.set(target, name, value, target);
        } else {
          debugger;
          console.log(`Creating field with name ${name} and value ${value}`);
          target.$fields.set(name, value);
          return true;
        }
      },
      has: function(target: DatabaseInstance<T>, prop: string): boolean {
        return ((typeof prop !== 'string' || prop.startsWith('$')) && Reflect.has(target, prop)) ||
            target.$fields.has(prop);
      }
    }) as T & DatabaseInstance<T>;
  }

  /** Protected area **/

  protected _db: Database;
  protected _spec: { [name: string]: FieldSpecWrapper } = {};
  protected _name: string;
  protected _constraints: string[] = [];
  protected _options: ModelOptions;

  protected _oneOrManyToOne(otherModel: Model<any>, relationField: string, otherRelationField: string|undefined,
                            unique: boolean) {
    if (this.getFieldSpec(relationField) == null) {
      this.addField(relationField, { typeHint: TypeHint.Integer, unique });
    } else {
      this.updateField(relationField, { unique });
    }

    if (otherRelationField == null) {
      // try to find a primary key for the other model and link to it
      otherRelationField = otherModel.getPrimaryKeyName();
    }

    this.addForeignKeyConstraint(relationField, otherModel, otherRelationField);
    return this;
  }
}

/**
 * Model specification.
 * It is basically an object map of all fields.
 */
export interface ModelSpec {
  [name: string]: FieldSpec;
}

/**
 * Specification of a single field.
 */
export interface FieldSpec {
  validate?: FieldValidator;

  /**
   * Called to convert a JS value to a database-suitable form.
   */
  serialize?: FieldSerializer;

  /**
   * Called to convert database value to a JS value
   */
  deserialize?: FieldDeserializer;

  /**
   * One of predefined types.
   * As sqlite does not use real strict typing, it is just a hint, and the field still can hold a value of any type.
   */
  typeHint?: TypeHint;

  /**
   * Whether null is accepted as a value for the field.
   * It is mapped to `NOT NULL` constraint in sql schema.
   * Note that is `allowNull` is true and value you are going to write into database is null, no validator is called.
   */
  allowNull?: boolean;

  /**
   * Default value for the field.
   * It is mapped to sql `DEFAULT` constraint and is not used by Model.build, so do not expect the instance created with Model.build to have this value for omitted fields.
   * Use newGenerate for such behaviour.
   */
  defaultValue?: string|number;

  /**
   * Routing for generating a default value for omitted properties when building new instances.
   * When creating a new instance with Model.build function, this function is called for each field.
   * This function is called before `validate` and `serialize`.
   * @param given The value for this field as given to Model.build
   * @returns {any} The generated value for the field.
   */
  newGenerate?: (given: any) => any;

  /**
   * Whether the field should be unique.
   * To make compound unique constraints, use Model.addUniqueConstraint.
   */
  unique?: boolean;

  /**
   * Whether the field is a primary key.
   * If more than one field of the model have this flag set, the primary key is going to be a compound one.
   */
  primaryKey?: boolean;

  /**
   * Collation to be used for text values.
   */
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

/**
 * Handy helper that wraps field specifications and provides extra functions.
 */
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

/**
 * Predefined validators that can be used with FieldSpec.validate parameter.
 */
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
  /**
   * If the value is true, each instance is going to have extra 'createdAt' field storing timestamp for inserting the instance into a database.
   */
  createTimestamp?: boolean;

  /**
   * If the value is true, each instance is going to have extra 'updatedAt' field storing timestamp for the last time the instance was modified.
   */
  updateTimestamp?: boolean;
}

export interface DatabaseOpenOptions {
  shouldCreate: boolean;
}

/**
 * Base ORM class.
 */
export class Database {
  /**
   * Defines a new model.
   * @param {string} modelName Name for the model
   * @param {{[p: string]: FieldSpec}} modelSpec Model specification
   * @param {ModelOptions} modelOptions Model options
   * @returns {Model<T>} Newly created model
   */
  define<T>(modelName: string, modelSpec: { [name: string]: FieldSpec }, modelOptions?: ModelOptions): Model<T> {
    let model = new Model<T>(this, modelName, modelSpec, modelOptions);
    this._models.push(model);
    return model;
  }

  /**
   * Get model with given name.
   * @param {string} modelName Model name
   * @returns {Model<T>|null} Model object or null if no model with given name defined.
   */
  getModel<T>(modelName: string): Model<T>|null {
    let foundModel = this._models.find(model => model.name === modelName);
    return foundModel == null ? null : foundModel;
  }

  /**
   * Creates sql schema for all defined models.
   * @returns {string} SQL schema
   */
  createSchema(): string {
    let schemaTables: string[] = [];

    for (let model of this._models) {
      let columns: string[] = [];
      let primaryKeyCount = 0;
      for (let fieldName of Object.keys(model.spec)) {
        let specWrapper = model.spec[fieldName];

        let parts: string[] = [];
        parts.push(fieldName);
        if (specWrapper.fieldSpec.typeHint != null) {
          parts.push(specWrapper.fieldSpec.typeHint);
        }
        if (specWrapper.fieldSpec.primaryKey === true) {
          parts.push('PRIMARY KEY');
          ++primaryKeyCount;
          if (primaryKeyCount > 1) {
            // compound primary keys are not supported
            throw new Error('Cannot create database schema: multiple primary keys are defined for model ' + model.name);
          }
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
      schemaTables.push(`CREATE TABLE ${model.name}(${columns.join(', ')})`);
    }

    return schemaTables.join('; ');
  }

  /**
   * Writes schema to the underlying database
   * @returns {Promise<void>}
   */
  async flushSchema(): Promise<void> {
    await this._db.exec(this.createSchema());
  }

  /**
   * Writes an database instance to the database.
   * @param {DatabaseInstance<any>} inst The instance
   * @returns {Promise<void>}
   */
  async createInstance<T>(inst: DatabaseInstance<any>): Promise<void> {
    let columns = [...inst.$fields.keys()];
    let values = columns.map(key => {
      let fieldWrapper = inst.$model.getFieldWrapper(key);
      if (!fieldWrapper) {
        throw new Error('Cannot find field data for property ' + key);
      }
      return fieldWrapper.convertToDatabaseForm(inst.$fields.get(key));
    });

    let valuesPlaceholders = new Array(values.length).fill('?').join(', ');

    let sql = `INSERT INTO ${inst.$model.name} (${columns}) VALUES (${valuesPlaceholders})`;
    this._logQuery(sql, values);
    let stmt = await this._db.run(sql, values);

    // if we have a field for a primary key, but it is not specified explicitly, we should set it now
    let pkName = inst.$model.getPrimaryKeyName();
    if (inst.$fields.has(pkName)) {
      inst.$fields.set(pkName, stmt.lastID);
    }

    inst.$rowId = stmt.lastID;
  }

  async updateInstance(inst: DatabaseInstance<any>, updateFields?: string[]): Promise<void> {
    if (!inst.$created) {
      throw new Error('Cannot update an instance that has not been created yet!');
    }

    let columns = updateFields == null ? [...inst.$fields.keys()] : updateFields;
    let values = columns.map(key => {
      let fieldWrapper = inst.$model.getFieldWrapper(key);
      if (!fieldWrapper) {
        throw new Error('Cannot find field data for property ' + key);
      }
      return fieldWrapper.convertToDatabaseForm(inst.$fields.get(key));
    });

    let placeholders = columns.map(column => {
      return column + ' = ?'
    });

    let pk = inst.$model.getPrimaryKeyName();
    values.push(inst.$rowId);

    let sql = `UPDATE ${inst.$model.name} SET ${placeholders} WHERE ${pk} = ?`;
    this._logQuery(sql, values);
    await this._db.run(sql, values);
  }

  async removeInstance(inst: DatabaseInstance<any>): Promise<void> {
    if (!inst.$created) {
      throw new Error('Cannot remove an instance that has not been created yet!');
    }

    let pk = inst.$model.getPrimaryKeyName();

    let sql = `DELETE FROM ${inst.$model.name} WHERE ${pk} = ?`;
    let values = [inst.$rowId];

    this._logQuery(sql, values);
    await this._db.run(sql, values);
  }

  /**
   * Opens of creates a new sqlite database.
   * @param {string} filename Path to sqlite database file
   * @param {DatabaseOpenOptions} options Database options.
   * By default, the function is going to create a new database if no database file exists.
   * If options.shouldCreate is false, the function is going to fail on missing database file.
   * @returns {Promise<Database>} New database object
   */
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

  protected _logQuery(query: string, bound: any[]): void {
    console.log('Q:', query, bound);
  }
}
