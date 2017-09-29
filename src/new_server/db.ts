import * as sqlite from 'better-sqlite3';
import {capitalize, isAlphaCode, isDigitCode, mapFromObject} from "../common/helpers";

const ROWID = 'rowid';

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
      rowId: null,
      relations: new Map()
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
  async $flush(updateFields?: string[]): Promise<void> {
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
  set $created(value: boolean) { this.$d.created = value; }

  /**
   * Implicit row id.
   * If instance is not flushed into a database, this value is null.
   * If object has already been removed, this value is null.
   * Otherwise, it has some unique value.
   */
  get $rowId(): any { return this.$d.rowId; }
  set $rowId(value: any) {
    this.$d.rowId = value;
    if (this.$fields.has(this.$model.getPrimaryKeyName())) {
      this.$fields.set(this.$model.getPrimaryKeyName(), value);
    }
  }

  /**
   * Map of all fields of the instance.
   * @returns {Map<string, any>} Map of <field name>: <field value>
   */
  get $fields(): Map<string, any> {
    return this.$d.fields;
  }

  get $relations(): Map<string, Relation> { return this.$d.relations; }

  $get(prop: string): any {
    if (this.$fields.has(prop)) {
      return this.$fields.get(prop);
    } else if (this.$relations.has(prop)) {
      return this.$relations.get(prop);
    } else {
      return undefined;
    }
  }

  $set(prop: string, value: any): boolean {
    if (this.$relations.has(prop)) {
      return false;
    } else {
      this.$fields.set(prop, value);
      let fsw = this.$model.getFieldWrapper(prop);
      if (fsw && fsw.fieldSpec.primaryKey === true) {
        this.$rowId = value;
      }
      return true;
    }
  }

  $has(prop: string): boolean {
    return this.$fields.has(prop) || this.$relations.has(prop)
  }

  /** Protected area **/

  protected $d: {
    db: Database,
    model: Model<T>,
    fields: Map<string, any>,
    created: boolean,
    rowId: any,
    relations: Map<string, Relation>
  };
}

export type Instance<T> = T & DatabaseInstance<T>;

interface PrivateRelation {
  getJoinCondition(model: Model<any>, companionAlias: string): string;
  relationData: RelationFieldData;
}

export interface Relation extends PrivateRelation {
  name: string;
}

export interface SingleRelation<T, R> extends Relation {
  get(): Promise<Instance<R>|null>;
  link(related: Instance<R>): Promise<void>;
  linkByPK(pk: any): Promise<void>;
  unlink(): Promise<void>;
}

export interface MultiRelation<T, R, RR> extends Relation {
  linkUsing(value: Instance<R>, relationTemplate: { [name: string]: any }): Promise<void>;
  link(...values: Instance<R>[]): Promise<void>;
  linkByPKUsing(pk: any, relationTemplate: { [name: string]: any }): Promise<void>;
  linkByPK(...pks: any[]): Promise<void>;
  unlink(...values: Instance<R>[]): Promise<void>;
  unlinkByPK(...pks: any[]): Promise<void>;
  unlinkWhere(where: WhereCriterion): Promise<void>;
  unlinkAll(): Promise<void>;
  find(options?: FindOptions): Promise<FindRelationResult<R, RR>>;
}

export interface SingleRelationOptions {
  foreignKey?: string;
  companionField?: string;
}

export interface MultiRelationOptions {
  model?: Model<any>|string;
  leftForeignKey?: string;
  rightForeignKey?: string;
  companionField?: string;
}

enum RelationType {
  OneToOne,
  ManyToOne,
  OneToMany,
  ManyToMany
}

interface RelationFieldData {
  name: string;
  type: RelationType;
  model: Model<any>;
  companionModel: Model<any>;
  isLeft: boolean;
}

interface SingleRelationFieldData extends RelationFieldData {
  foreignKey: string;
}

interface MultiRelationFieldData extends RelationFieldData {
  relationModel: Model<any>;
  leftForeignKey: string;
  rightForeignKey: string;
}

class DbRelation<T> {
  constructor(inst: DatabaseInstance<T>) {
    this._inst = inst;
  }

  protected _ensureGood(): void {
    if (this._inst.$rowId == null || !this._inst.$created) {
      throw new InstanceInvalidError();
    }
  }

  protected _ensureRelatedInstancesGood(instances: DatabaseInstance<any>[], expectedModel: Model<any>): void {
    for (let inst of instances) {
      if (!inst.$created || inst.$rowId == null) {
        throw new InstanceInvalidError();
      }
      if (inst.$model !== expectedModel) {
        throw new ModelMismatchError();
      }
    }
  }

  protected _ensureRelatedPksGood(pks: any[]): void {

  }

  /** Protected area **/

  protected _inst: DatabaseInstance<T>;
}

/**
 * Handles one-to-one relationships for both sides, many-to-one for left side and one-to-many for right side.
 * In all cases, the model that has DbSingleRelation attached, stores primary key value of companion model.
 * A single exception is one-to-one relationship where DbSingleRelation is attached to right side model.
 * In this case isCompanion flag is true, and its companion model stores the primary key of the current model.
 */
class DbSingleRelation<T, R> extends DbRelation<T> implements SingleRelation<T, R> {
  constructor(inst: DatabaseInstance<T>, d: SingleRelationFieldData) {
    super(inst);
    this._d = d;
  }

  /**
   * Gets the instance linked to the current model.
   * @returns {Promise<Instance<R>>} Linked instance or null if no instance linked.
   */
  async get(): Promise<Instance<R>|null> {
    if (!this._isCompanion) {
      // just find a companion instance by its primary key
      let fk = this._inst.$get(this._d.foreignKey);
      return fk == null ? null : this._d.companionModel.findByPK(fk);
    } else {
      // we should find an instance which foreign key is equal to our primary key
      if (!this._inst.$rowId == null || !this._inst.$created) {
        return null;
      } else {
        return this._d.companionModel.findOne({
          where: {
            [this._d.foreignKey]: this._inst.$rowId
          }
        });
      }
    }
  }

  /**
   * Links an existing instance to the current instance.
   * @param {Instance<R>} related Model to link to
   * @returns {Promise<void>} Fulfilled when done
   */
  async link(related: Instance<R>): Promise<void> {
    if (!related.$created || related.$rowId == null) {
      throw new Error('Cannot create a relation: primary key undefined or instance has not been flushed');
    }
    if (related.$model != this._d.companionModel) {
      throw new Error('Cannot create a relation: an instance given has incorrect model');
    }

    return this.linkByPK(related.$rowId);
  }

  /**
   * Same as link, but does not require creating and fetching an instance to link if you know its primary key value.
   * @param pk Primary key value of instance to link.
   * @returns {Promise<void>} Fulfilled when done
   */
  async linkByPK(pk: any): Promise<void> {
    if (pk == null) {
      throw new Error('Cannot create relation: primary key is undefined');
    }

    if (!this._isCompanion) {
      // just set our foreign key to the primary key of an item we want to link
      this._inst.$set(this._d.foreignKey, pk);
      return this._inst.$flush([ this._d.foreignKey ]);
    } else {
      // set a foreign key on the related instance to the value of our primary key
      let related = await this._d.companionModel.findByPK(pk);
      if (related == null) {
        throw new Error('Cannot create a relation: no instance with given primary key found');
      }
      related.$set(this._d.foreignKey, this._inst.$rowId);
      return related.$flush([ this._d.foreignKey ]);
    }
  }

  /**
   * Unlink the currently linked instance.
   * If no instance linked, does nothing.
   * @returns {Promise<void>} Fulfilled when done
   */
  async unlink(): Promise<void> {
    if (!this._isCompanion) {
      this._inst.$set(this._d.foreignKey, null);
      return this._inst.$flush([ this._d.foreignKey ]);
    } else {
      return this._d.companionModel.update({
        where: {
          [this._d.foreignKey]: this._inst.$rowId
        },
        set: {
          [this._d.foreignKey]: null
        }
      });
    }
  }

  get name(): string { return this._d.name; }

  getJoinCondition(model: Model<any>, companionAlias: string): string {
    if (model === this._d.model) {
      let companionPk = this._d.companionModel.getPrimaryKeyName();
      if (!this._isCompanion) {
        return `${companionAlias}.${companionPk} = ${model.name}.${this._d.foreignKey}`;
      } else {
        return `${companionAlias}.${this._d.foreignKey} = ${model.name}.${this._d.model.getPrimaryKeyName()}`;
      }
    } else {
      throw new Error('Relation.getJoinCondition: invalid model');
    }
  }

  get relationData(): RelationFieldData { return this._d; }

  /** Protected area **/

  protected _d: SingleRelationFieldData;

  protected get _isCompanion(): boolean {
    return this._d.type === RelationType.OneToOne && !this._d.isLeft;
  }
}

class ModelMismatchError extends Error {
  constructor() {
    super('Cannot create a relation: an instance given has incorrect model')
  }
}

class InstanceInvalidError extends Error {
  constructor() {
    super('Cannot link an instance: primary key is invalid or instance not flushed');
  }
}

/**
 * Handles one-to-many for left side and many-to-one for right side.
 * In all cases, the companion model stores primary indexes of instances of this model and this primary key can be repeated.
 */
class DbManyRelation<T, R> extends DbRelation<T> implements MultiRelation<T, R, void> {
  constructor(inst: DatabaseInstance<T>, d: SingleRelationFieldData) {
    super(inst);
    this._d = d;
  }

  get name(): string { return this._d.name; }

  async link(...instances: Instance<R>[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedInstancesGood(instances, this._d.companionModel);

    return this.linkByPK(...instances.map(x => x.$rowId));
  }

  async linkByPK(...pks: any[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedPksGood(pks);

    await this._d.companionModel.update({
      where: {
        [this._d.companionModel.getPrimaryKeyName()]: {
          $in: pks
        }
      },
      set: {
        [this._d.foreignKey]: this._inst.$rowId
      }
    });
  }

  linkUsing(value: Instance<R>, relationTemplate: { [p: string]: any }): Promise<void> {
    return this.link(value);
  }

  linkByPKUsing(pk: any, relationTemplate: { [p: string]: any }): Promise<void> {
    return this.linkByPK(pk);
  }

  async unlink(...values: Instance<R>[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedInstancesGood(values, this._d.companionModel);

    return this.unlinkByPK(...values.map(x => x.$rowId));
  }

  async unlinkByPK(...pks: any[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedPksGood(pks);

    return this._d.companionModel.update({
      where: {
        [this._d.companionModel.getPrimaryKeyName()]: {
          $in: pks
        }
      },
      set: {
        [this._d.foreignKey]: null
      }
    });
  }

  async unlinkWhere(where: WhereCriterion): Promise<void> {
    this._ensureGood();

    let crit: WhereCriterion = Object.assign({}, where);
    crit[this._d.foreignKey] = this._inst.$rowId;

    return this._d.companionModel.update({
      where: crit,
      set: {
        [this._d.foreignKey]: null
      }
    });
  }

  async unlinkAll(): Promise<void> {
    this._ensureGood();

    return this.unlinkWhere({
      where: { }
    });
  }

  async find(options: FindOptions): Promise<FindRelationResult<R, void>> {
    this._ensureGood();

    let result = await this._d.companionModel.find({
      where: {
        [this._d.foreignKey]: {
          $eq: this._inst.$rowId
        }
      }
    }) as FindRelationResult<R, void>;
    result.relationItems = [];
    return result;
  }

  getJoinCondition(model: Model<any>, companionAlias: string): string {
    if (model === this._d.model) {
      return `${companionAlias}.${this._d.foreignKey} = ${model.name}.${model.getPrimaryKeyName()}`;
    } else {
      throw new Error('Relation.getJoinCondition: invalid model');
    }
  }

  get relationData(): RelationFieldData { return this._d; }

  /** Protected area **/

  protected _d: SingleRelationFieldData;
}

/**
 * Handles both sides for many-to-many relation.
 * This relation is implemented through extra table that stores primary keys for both models.
 */
class DbMultiRelation<T, R, RR> extends DbRelation<T> implements MultiRelation<T, R, RR> {
  constructor(inst: DatabaseInstance<T>, rd: MultiRelationFieldData) {
    super(inst);
    this._d = rd;
  }

  async link(...values: Instance<R>[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedInstancesGood(values, this._d.companionModel);

    return this.linkByPK(...values.map(x => x.$rowId));
  }

  linkUsing(value: Instance<R>, relationTemplate: { [p: string]: any }): Promise<void> {
    this._ensureGood();
    this._ensureRelatedInstancesGood([value], this._d.companionModel);

    return this.linkByPKUsing(value.$rowId, relationTemplate);
  }

  async linkByPK(...pks: any[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedPksGood(pks);

    for (let pk of pks) {
      let newRelation = this._d.relationModel.build({
        [this.myForeignKey]: this._inst.$rowId,
        [this.otherForeignKey]: pk
      });
      await newRelation.$flush();
    }
  }

  linkByPKUsing(pk: any, relationTemplate: { [p: string]: any }): Promise<void> {
    this._ensureGood();
    this._ensureRelatedPksGood([pk]);

    let newRelation = this._d.relationModel.build(Object.assign({}, relationTemplate, {
      [this.myForeignKey]: this._inst.$rowId,
      [this.otherForeignKey]: pk
    }));
    return newRelation.$flush();
  }

  async unlink(...values: Instance<R>[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedInstancesGood(values, this._d.companionModel);

    return this.unlinkByPK(values.map(x => x.$rowId));
  }

  async unlinkByPK(...pks: any[]): Promise<void> {
    this._ensureGood();
    this._ensureRelatedPksGood(pks);

    return this._d.relationModel.remove({
      where: {
        [this.myForeignKey]: this._inst.$rowId,
        [this.otherForeignKey]: {
          $in: pks
        }
      }
    });
  }

  async unlinkWhere(where: WhereCriterion): Promise<void> {
    this._ensureGood();

    let crit: WhereCriterion = Object.assign({}, where);
    crit[this.myForeignKey] = this._inst.$rowId;

    return this._d.relationModel.remove({
      where: crit
    });
  }

  async unlinkAll(): Promise<void> {
    this._ensureGood();

    return this._d.relationModel.remove({
      where: {
        [this.myForeignKey]: this._inst.$rowId
      }
    });
  }

  /**
   * Get related instances and relation instances.
   * @param {FindOptions} options Search options.
   * This object should not have join option.
   * Any other options are permitted.
   * Note that 'where' option is applied to items of companion table, not the relation table.
   * To filter results by relation table properties, use relationModelName$relationProp conditions.
   * For example:
   * foo.bars.find({ where: { name: 'some name', foobar$relationType: 1 } });
   * @returns {Promise<FindRelationResult<R, RR>>}
   */
  async find(options?: FindOptions): Promise<FindRelationResult<R, RR>> {
    if (options && options.join != null) {
      throw new Error('Cannot get list of related items: search options should not have join clause');
    }
    if (options && options.hasOwnProperty(this.myForeignKey)) {
      throw new Error('Cannot get list of related items: search options are invalid');
    }

    // select ... from relation inner join right on right.id = relation.rightId where right.prop = prop and relation.prop = prop

    let whereRelated: WhereCriterion = {
      [this.myForeignKey]: this._inst.$rowId
    };
    let where: WhereCriterion = Object.assign({}, options ? options.where : {}, whereRelated);

    // we query for items of relation table, and join them with items from companion table.
    // so result object will have relation instances as result.items and related companion instances as result.joined[some_name]
    let interResult = await this._d.relationModel.find({
      where,
      join: [ { relation: this, type: JoinType.Inner } ],
      ...options
    });

    // to transform the result to required form, we should place related companion instances to result.items,
    // instances of relation table -- to result.relatedItems.
    // no other joins should be present in result.

    let relatedItems: Instance<any>[] = interResult.joined && interResult.joined[this.name] ? interResult.joined[this.name] : [];

    return {
      totalCount: interResult.totalCount,
      items: relatedItems,
      relationItems: interResult.items
    };
  }

  get name(): string { return this._d.name; }

  getJoinCondition(model: Model<any>, companionAlias: string): string {
    let companionPk = this._d.companionModel.getPrimaryKeyName();
    if (model === this._d.relationModel) {
      return `${companionAlias}.${companionPk} = ${model.name}.${this.otherForeignKey}`
    } else if (model === this._d.model) {
      let relationName = this._d.relationModel.name;
      return `${companionAlias}.${companionPk} IN (SELECT ${this.otherForeignKey} FROM ${relationName} WHERE ${this.myForeignKey} = ${this._d.model.name}.${this._d.model.getPrimaryKeyName()}`;
    } else {
      throw new Error('Relation.getJoinCondition: invalid model');
    }
  }

  get relationData(): RelationFieldData { return this._d; }

  /** Protected area **/

  protected _d: MultiRelationFieldData;

  protected get myForeignKey(): string {
    return this._d.isLeft ? this._d.leftForeignKey : this._d.rightForeignKey;
  }

  protected get otherForeignKey(): string {
    return this._d.isLeft ? this._d.rightForeignKey : this._d.leftForeignKey;
  }
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
      updateTimestamp: false,
      defaultSorting: null
    } as ModelOptions, options);

    if (typeof this._options.defaultSorting === 'string') {
      this._options.defaultSorting = {
        by: this._options.defaultSorting,
        order: SortOrder.Asc
      };
    }

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
   * List of all fields registered for this model.
   * @returns {FieldSpecWrapper[]} List of fields
   */
  get fields(): FieldSpecWrapper[] {
    return Object.keys(this._spec).map(key => this._spec[key]) as FieldSpecWrapper[];
  }

  get relations(): RelationFieldData[] {
    return this._relationFields;
  }

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

  get defaultSorting(): SortProp|null { return this._options.defaultSorting as SortProp|null; }

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
   * Just list getField wrapper, but throws an error instead of returning null
   * @param {string} name Name of the field you are interested in
   * @returns {FieldSpecWrapper} Field spec
   */
  getFieldWrapperChecked(name: string): FieldSpecWrapper {
    let fw = this.getFieldWrapper(name);
    if (fw == null) {
      throw new Error(`No field named [${fw}] found. Asked for a field named ${name}, but we have only the following fields: ${this.fields.map(x => x.fieldName)}`);
    }
    return fw;
  }

  /**
   * Adds a new field to the model.
   * @param {string} fieldName Name of the field to add.
   * @param {FieldSpec} fieldSpec Field specification
   * @returns {Model<T>} This model
   */
  addField(fieldName: string, fieldSpec: FieldSpec): Model<T> {
    if (!isValidName(fieldName)) {
      throw new Error(`Cannot define field: [${fieldName}] is invalid name for a field`);
    }
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
    let primary = this.fields.find(fsw => fsw.fieldSpec.primaryKey === true);
    return primary == null ? ROWID : primary.fieldName;
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
   * @param {string} field Field which will be used to access the relation
   * @param {string} options Relation options
   * @returns {Model<T>} This model
   */
  oneToOne(otherModel: Model<any>|string, field?: string|null, options?: SingleRelationOptions): Model<T> {
    return this._oneOrManyToOne(otherModel, field, options, RelationType.OneToOne);
  }

  /**
   * Creates a new many-to-one relation with another model.
   * It works just like one-to-one relation, but relation field is not unique.
   * @param {Model<any>} otherModel A model to add the relation to
   * @param {string} field A field which will be used to access the relation
   * @param {string} options Relation options
   * @returns {Model<T>} This model
   */
  manyToOne(otherModel: Model<any>|string, field?: string|null, options?: SingleRelationOptions): Model<T> {
    return this._oneOrManyToOne(otherModel, field, options, RelationType.ManyToOne);
  }

  /**
   * Creates a new one-to-many relation with another model.
   * Relation is implemented like it would be one-to-many relation on otherModel with this model.
   * @param {Model<any>} otherModel A model to add the relation to
   * @param {string} field A field to be used to access the relation
   * @param {string} options Relation options
   * @returns {Model<T>} This model
   */
  oneToMany(otherModel: Model<any>|string, field?: string|null, options?: SingleRelationOptions): Model<T> {
    if (typeof otherModel === 'string') {
      let m = this._db.getModel(otherModel);
      if (m == null) {
        throw new Error(`Cannot create relation: no model named [${otherModel}] defined`);
      }
      otherModel = m;
    }

    otherModel._oneOrManyToOne(this, options && options.companionField ? options.companionField : null, {
      foreignKey: options && options.foreignKey ? options.foreignKey : undefined,
      companionField: field == null ? undefined : field
    }, RelationType.OneToMany, true);

    return this;
  }

  /**
   * Creates a new many-to-many relation with another model.
   * This relation is implemented by creating a relation table which stores pairs of foreign keys to both models.
   * @param {Model<any>} otherModel A model to add the relation to
   * If no model with the provided name exist, new one will be created.
   * You can use an existing model to make the relation table have other fields.
   * @param field A field to be used to access the relation
   * @param options Relation options
   * @returns {Model<T>} This model
   */
  manyToMany(otherModel: Model<any>|string, field?: string|null, options?: MultiRelationOptions): Model<T> {
    // resolve other model
    if (typeof otherModel === 'string') {
      let m = this._db.getModel(otherModel);
      if (m == null) {
        throw new Error(`Cannot create relation: no model named [${otherModel}] defined`);
      }
      otherModel = m;
    }

    // find model to be used as a relation table
    let relationModel: Model<any>|null = null;
    if (options && options.model && typeof options.model !== 'string') {
      // use provided model for it
      relationModel = options.model;
    } else {
      // create a new model for relation
      let relModelName: string;
      if (options && options.model && typeof options.model === 'string') {
        // if model name is provided, use it
        relModelName = options.model;
        let existingRelModel = this._db.getModel(relModelName);
        if (existingRelModel != null) {
          relationModel = existingRelModel;
        }
      } else {
        // generate a name for relation model
        relModelName = this.name + capitalize(otherModel.name);
      }

      if (relationModel == null) {
        relationModel = this._db.define(relModelName, { });
      }
    }

    // initalize relation table, add fields and constraints
    let leftForeignKey = options && options.leftForeignKey ? options.leftForeignKey : this.name + 'id';
    let rightForeignKey = options && options.rightForeignKey ? options.rightForeignKey : otherModel.name + 'id';

    relationModel.updateField(leftForeignKey, { typeHint: TypeHint.Integer });
    relationModel.updateField(rightForeignKey, { typeHint: TypeHint.Integer });
    relationModel.addForeignKeyConstraint(leftForeignKey, this, this.getPrimaryKeyName());
    relationModel.addForeignKeyConstraint(rightForeignKey, otherModel, otherModel.getPrimaryKeyName());
    relationModel.addUniqueConstraint([leftForeignKey, rightForeignKey]);

    // add relation field to manipulate the relation
    if (field) {
      this._addRelationField({
        name: field,
        type: RelationType.ManyToMany,
        model: this,
        companionModel: otherModel,
        isLeft: true,
        relationModel,
        leftForeignKey,
        rightForeignKey
      } as MultiRelationFieldData);
    }

    if (options && options.companionField) {
      otherModel._addRelationField({
        name: options.companionField,
        type: RelationType.ManyToMany,
        model: otherModel,
        companionModel: this,
        isLeft: false,
        relationModel,
        leftForeignKey,
        rightForeignKey
      } as MultiRelationFieldData);
    }

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
   * @returns {Instance<T>} New instance.
   * This instance has all properties that correspond to the fields of the model, plus DatabaseInstance methods that start with $.
   */
  build(template: { [name: string]: any }): Instance<T> {
    let inst = new DatabaseInstance(this._db, this);
    for (let field of this.fields) {
      let given = template[field.fieldName];
      if (given == null && field.fieldSpec.newGenerate != null) {
        given = field.fieldSpec.newGenerate(given);
      }
      if (given == null) {
        given = null;
      }
      inst.$fields.set(field.fieldName, given);
    }

    return this._makeInstance(inst);
  }

  /**
   * Creates an instance from database query result.
   * Should not by used by end user.
   * @param {{[p: string]: any}} sqlResult Sql result
   * @param {string} prefix Table prefix for instance data
   * @returns {Instance<T>} Created instance
   */
  buildFromDatabaseResult(sqlResult: { [name: string]: any }, prefix?: string): Instance<T> {
    let result = new DatabaseInstance(this._db, this);
    for (let field of this.fields) {
      let value: any;
      let fieldName = prefix ? prefix + '.' + field.fieldName : field.fieldName;

      if (sqlResult.hasOwnProperty(fieldName)) {
        result.$fields.set(field.fieldName, value = field.convertFromDatabaseForm(sqlResult[fieldName]));
      } else {
        throw new Error(`No database value for field [${fieldName}] of model [${this.name}]. Result dump: ${sqlResult}`);
      }

      if (field.fieldSpec.primaryKey) {
        result.$rowId = value;
      }
    }

    if (result.$rowId == null) {
      let qualifiedRowid = this.name + '.' + ROWID;
      if (!Reflect.has(sqlResult, qualifiedRowid) && !Reflect.has(sqlResult, ROWID)) {
        throw new Error(`No rowid database value for an instance of model [${this.name}] (tried name ${qualifiedRowid} and ${ROWID})`);
      } else {
        let rowid = Reflect.has(sqlResult, ROWID) ? sqlResult[ROWID] : sqlResult[qualifiedRowid];
        if (typeof rowid !== 'number') {
          throw new Error(`Invalid rowid value type for an instance of model [${this.name}]`);
        }
        result.$rowId = rowid;
      }
    }

    result.$created = true;

    return this._makeInstance(result);
  }

  /**
   * Search instances by a criteria.
   * @param {FindOptions} options Search criteria and options
   * @returns {Promise<FindResult<T>>} Result set
   */
  async find(options?: FindOptions): Promise<FindResult<T>> {
    return this._db.find(this, options || {});
  }

  /**
   * Updates instances by given criteria, setting specified fields to given values.
   * @param {UpdateOptions} options Search criteria and options.
   * 'where' property specified search criteria.
   * 'set' property lists fields and values that updated instances will have.
   * For example:
   * model.update({
   *   where: { name: 'old name' },
   *   set: { name: 'new name' }
   * });
   * will replace all occupiences of 'old name' with 'new name'
   * @returns {Promise<void>} Fulfilled when done.
   */
  async update(options: UpdateOptions): Promise<void> {
    return this._db.update(this, options);
  }

  /**
   * Removes instances matching given criteria.
   * @param {RemoveOptions} options Search criteria.
   * 'where' property specifies search criteria.
   * You should not call the method without 'where' property to remove all instances of current model.
   * Such behaviour is prohibited for security purposes.
   * To remove all instances, explicitly use removeAll function.
   * @returns {Promise<void>} Fulfilled when done.
   */
  async remove(options: RemoveOptions): Promise<void> {
    return this._db.remove(this, options);
  }

  /**
   * Removes all instances of given model from database.
   * @returns {Promise<void>} Fulfilled when done.
   */
  async removeAll(): Promise<void> {
    return this._db.removeAll(this);
  }

  /**
   * Returns a first instance matching a query.
   * If no instances matching criteria found, null is returned.
   * @param {FindOptions} options Search criteria and options
   * @returns {Promise<Instance<T>>} Result or null if no results.
   */
  async findOne(options?: FindOptions): Promise<Instance<T> | null> {
    let results = await this._db.find(this, Object.assign({}, options, {
      limit: 1,
      fetchTotalCount: false
    } as FindOptions));
    return results.items.length > 0 ? results.items[0] : null;
  }

  /**
   * Just list findOne, but throws an error when no instances found.
   * @param {FindOptions} options Search criteria and options
   * @returns {Promise<Instance<T>>} Result
   */
  async findOneChecked(options?: FindOptions): Promise<Instance<T>> {
    let r = await this.findOne(options);
    if (r == null) {
      throw new Error('No instance matching criteria found');
    }
    return r;
  }

  /**
   * Finds and instance with given primary key.
   * @param pkValue Primary key value
   * @returns {Promise<Instance<T>>} Instance or null if no instance found
   */
  async findByPK(pkValue: any): Promise<(Instance<T>) | null> {
    let results = await this._db.find(this, {
      where: {
        [this.getPrimaryKeyName()]: pkValue
      }
    });
    return results.items.length > 0 ? results.items[0] : null;
  }

  /**
   * Just like findByPK, but throws and error instead of returning null.
   * @param pkValue Primary key value
   * @returns {Promise<Instance<T>>} Instance with given primary key
   */
  async findByPKChecked(pkValue: any): Promise<Instance<T>> {
    let r = await this.findByPK(pkValue);
    if (r == null) {
      throw new Error('No instance with given primary key found');
    }
    return r;
  }

  /**
   * Returns number of instances of this model in the database.
   * @returns {Promise<number>} Number of instances
   */
  async count(): Promise<number> {
    return this._db.count(this);
  }

  /** Protected area **/

  protected _db: Database;
  protected _spec: { [name: string]: FieldSpecWrapper } = {};
  protected _name: string;
  protected _constraints: string[] = [];
  protected _options: ModelOptions;
  protected _relationFields: RelationFieldData[] = [];

  protected _oneOrManyToOne(otherModel: Model<any>|string, field: string|null|undefined,
                            options: SingleRelationOptions|undefined, type: RelationType,
                            swapLeftRight: boolean = false) {
    let unique = type === RelationType.OneToOne;

    // resolve model
    if (typeof otherModel === 'string') {
      let m = this._db.getModel(otherModel);
      if (m == null) {
        throw new Error(`Cannot create a relation: model [${otherModel}] is not defined`);
      }
      otherModel = m;
    }

    // create a column to hold foreign key
    let foreignKey = options && options.foreignKey ? options.foreignKey : otherModel.name + 'id';
    if (this.getFieldSpec(foreignKey) == null) {
      this.addField(foreignKey, { typeHint: TypeHint.Integer, unique });
    } else {
      this.updateField(foreignKey, { unique });
    }

    // create constraint for the foreign key
    this.addForeignKeyConstraint(foreignKey, otherModel, otherModel.getPrimaryKeyName());

    if (field) {
      this._addRelationField({
        name: field,
        type,
        model: this,
        companionModel: otherModel,
        isLeft: !swapLeftRight,
        foreignKey
      } as SingleRelationFieldData);
    }

    if (options && options.companionField) {
      otherModel._addRelationField({
        name: options.companionField,
        type,
        model: otherModel,
        companionModel: this,
        isLeft: swapLeftRight,
        foreignKey
      } as SingleRelationFieldData);
    }

    return this;
  }

  protected _checkRelationFieldName(name: string): void {
    if (!isValidName(name)) {
      throw new Error(`Cannot create a relation: [${name}] is invalid name for a field`);
    } else if (this.getFieldSpec(name) != null || this._getRelationFieldData(name) != null) {
      throw new Error(`Cannot create a relation: field [${name}] is already reserved`);
    }
  }

  protected _addRelationField(d: RelationFieldData): void {
    this._checkRelationFieldName(d.name);
    this._relationFields.push(d);
  }

  protected _getRelationFieldData(name: string): RelationFieldData|null {
    let f = this._relationFields.find(x => x.name === name);
    return f == null ? null : f;
  }

  protected _makeInstance(inst: DatabaseInstance<T>): Instance<T> {
    // initialize relations for the instance
    for (let relation of this._relationFields) {
      let accesser: Relation;
      switch (relation.type) {
        case RelationType.ManyToMany:
          accesser = new DbMultiRelation(inst, relation as MultiRelationFieldData);
          break;

        case RelationType.OneToOne:
          accesser = new DbSingleRelation(inst, relation as SingleRelationFieldData);
          break;

        case RelationType.ManyToOne:
          if (relation.isLeft) {
            accesser = new DbSingleRelation(inst, relation as SingleRelationFieldData);
          } else {
            accesser = new DbManyRelation(inst, relation as SingleRelationFieldData);
          }
          break;

        case RelationType.OneToMany:
          if (relation.isLeft) {
            accesser = new DbManyRelation(inst, relation as SingleRelationFieldData);
          } else {
            accesser = new DbSingleRelation(inst, relation as SingleRelationFieldData);
          }
          break;

        default:
          throw new Error('Unexpected relation type');
      }

      inst.$relations.set(relation.name, accesser);
    }

    return new Proxy(inst, {
      get: function(target: DatabaseInstance<T>, name: string, receiver: any): any {
        if (!(typeof name === 'string') || name.startsWith('$') || Reflect.has(target, name)) {
          return Reflect.get(target, name, target);
        } else {
          return target.$get(name);
        }
      },
      set: function(target: DatabaseInstance<T>, name: string, value: any, receiver: any): boolean {
        if (!(typeof name === 'string') || name.startsWith('$') || Reflect.has(target, name)) {
          return Reflect.set(target, name, value, target);
        } else {
          return target.$set(name, value);
        }
      },
      has: function(target: DatabaseInstance<T>, prop: string): boolean {
        return ((typeof prop !== 'string' || prop.startsWith('$')) && Reflect.has(target, prop)) ||
            target.$has(prop);
      }
    }) as Instance<T>;
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
   * By default, allow null is true.
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
    let fieldSpec = this.fieldSpec;

    if (fieldSpec.allowNull !== false && value == null) {
      return null;
    }

    if (fieldSpec.validate != null) {
      if (!fieldSpec.validate(value)) {
        throw new Error(`Invalid value for a property value ${this.fieldName}`);
      }
    }

    return fieldSpec.serialize == null ? value : fieldSpec.serialize(value);
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

  defaultSorting?: string|SortProp|null;
}

export interface DatabaseOpenOptions {
  shouldCreate?: boolean;
  inMemory?: boolean;
}

export enum SortOrder {
  Asc,
  Desc
}

export interface SortProp {
  by: string;
  order?: SortOrder;
  caseSensitive?: boolean;
}

type WhereCriterion = { [name: string]: any };

export interface QueryOptions {
  /**
   * Search criteria
   */
  where?: WhereCriterion
}

export enum JoinType {
  Inner = 'INNER',
  Left = 'LEFT'
}

export interface JoinOption {
  relation: Relation;
  type: JoinType;
}

/**
 * Search criteria and options
 */
export interface FindOptions extends QueryOptions {
  limit?: number;
  offset?: number;

  /**
   * Whether we should get a total count of results (count of results without LIMIT).
   */
  fetchTotalCount?: boolean;

  /**
   * Sorting options.
   */
  sort?: (SortProp|string)[];

  join?: JoinOption[];
}

export interface UpdateOptions extends QueryOptions {
  set: {
    [name: string]: any
  }
}

export interface RemoveOptions extends QueryOptions {

}

interface WhereResult {
  query: string;
  bound: SqlBoundParams;
}

export interface FindResult<T> {
  totalCount?: number|null;
  items: Instance<T>[];
  joined?: { [name: string]: Instance<any>[] };
}

export interface FindRelationResult<T, R> extends FindResult<T> {
  relationItems: Instance<R>[];
}

type SqlBindings = { [name: string]: any };

class SqlBoundParams {
  static uniqueName(): string {
    return 'uniq_' + Math.floor(Math.random() * 100000);
  }

  bind(value: any): string {
    let bindingName = SqlBoundParams.uniqueName();
    this._bound[bindingName] = value;
    return ':' + bindingName;
  }

  merge(another: SqlBoundParams): void {
    Object.assign(this._bound, another._bound);
  }

  get count(): number { return Object.keys(this._bound).length; }

  get sqlBindings(): SqlBindings { return this._bound; }

  /** Protected area **/

  protected _bound: SqlBindings = {};
}

interface SqlQueryParams {
  where: string[];
  constraints?: string[];
  bound: SqlBoundParams;
  joins?: string[];
  extraColumns?: string[];
}

const CHAR_UNDERSCORE = '_'.charCodeAt(0);
function isValidName(name: string): boolean {
  if (name.length === 0 || !isAlphaCode(name.charCodeAt(0))) {
    return false;
  }
  for (let j = 1; j < name.length; ++j) {
    let ch = name.charCodeAt(j);
    if (!(isAlphaCode(ch) || isDigitCode(ch) || ch === CHAR_UNDERSCORE)) {
      return false;
    }
  }
  return true;
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
    if (!isValidName(modelName)) {
      throw new Error(`Cannot define model: [${modelName}] is invalid name for a model`);
    }
    if (this.getModel(modelName)) {
      throw new Error(`Cannot define model: [${modelName}] already defined`);
    }
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
    if (this._schemaFlushed) {
      throw new Error('Database schema has already been flushed');
    }
    let schema = this.createSchema();
    await this._db.exec(schema);
    this._schemaFlushed = true;
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

    let sql = `INSERT INTO ${inst.$model.name} (${columns.join(', ')}) VALUES (${valuesPlaceholders})`;
    let runResult = this._prepare(sql, values).run();

    // if we have a field for a primary key, but it is not specified explicitly, we should set it now
    let pkName = inst.$model.getPrimaryKeyName();
    if (inst.$fields.has(pkName)) {
      inst.$fields.set(pkName, runResult.lastInsertROWID);
    }

    inst.$rowId = runResult.lastInsertROWID;
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
    await this._prepare(sql, values).run();
  }

  async removeInstance(inst: DatabaseInstance<any>): Promise<void> {
    if (!inst.$created) {
      throw new Error('Cannot remove an instance that has not been created yet!');
    }

    let pk = inst.$model.getPrimaryKeyName();

    let sql = `DELETE FROM ${inst.$model.name} WHERE ${pk} = ?`;
    let values = [inst.$rowId];

    await this._prepare(sql, values).run();
  }

  async find<T>(model: Model<T>, options: FindOptions): Promise<FindResult<T>> {
    let q = this._findOptionsToQuery(model, options);

    // build list of columns we should fetch from database
    let columns: string[] = this._makeColumnListForModel(model);
    if (q.extraColumns != null) {
      columns.push(...q.extraColumns);
    }

    let whereClause: string = this._makeWhere(q.where);
    let joins = q.joins == null ? '' : q.joins.join(' ');
    let constraints = q.constraints == null ? '' : q.constraints.join(' ');
    let sql = `SELECT ${columns.join(', ')} FROM ${model.name} ${joins} ${whereClause} ${constraints}`;
    let sqlResults = this._prepare(sql, q.bound).all();

    let result: FindResult<T> = {
      totalCount: null,
      items: []
    };
    for (let sqlResult of sqlResults) {
      result.items.push(model.buildFromDatabaseResult(sqlResult));
    }

    // create instances for requested joins
    if (options.join && options.join.length > 0) {
      result.joined = {};
      for (let joinOption of options.join) {
        let items: Instance<any>[] = (result.joined[joinOption.relation.name] = []);
        for (let sqlResult of sqlResults) {
          let joinedModel = joinOption.relation.relationData.companionModel;
          items.push(joinedModel.buildFromDatabaseResult(sqlResult, joinOption.relation.name));
        }
      }
    }

    if (options.fetchTotalCount === true) {
      // we should run an extra query to get total number of rows without taking limit and offset into account
      let countConstraints: string = '';
      if (q.constraints != null) {
        countConstraints = q.constraints.filter(constr => !constr.startsWith('LIMIT')).join(' ');
      }
      let joins = q.joins == null ? '' : q.joins.join(' ');
      let countSql = `SELECT COUNT(*) FROM ${model.name} ${joins} ${whereClause} ${countConstraints}`;
      let countResult = this._prepare(countSql, q.bound).get();
      result.totalCount = countResult['COUNT(*)'] as number;
    }

    return result;
  }

  async update<T>(model: Model<T>, options: UpdateOptions): Promise<void> {
    let q = this._simpleOptionsToQuery(model, options);

    let columns = Object.keys(options.set);
    if (columns.length === 0) {
      // nothing to update
      return;
    }

    let setClause: string = columns.map(
        col => col + ' = ' + q.bound.bind(model.getFieldWrapperChecked(col).convertToDatabaseForm(options.set[col]))
    ).join(', ');

    let whereClause = this._makeWhere(q.where);
    let sql = `UPDATE ${model.name} SET ${setClause} ${whereClause}`;
    let res = await this._prepare(sql, q.bound).run();
  }

  async remove<T>(model: Model<T>, options: RemoveOptions): Promise<void> {
    let q = this._simpleOptionsToQuery(model, options);

    if (!q.where || q.where.length === 0) {
      throw new Error('Attempted to call Model.remove without search criteria. To remove all instances, use Model.removeAll');
    }

    let whereClause = this._makeWhere(q.where);
    let sql = `DELETE FROM ${model.name} ${whereClause}`;

    await this._prepare(sql, q.bound).run();
  }

  async removeAll<T>(model: Model<T>): Promise<void> {
    let sql = `DELETE FROM ${model.name}`;
    await this._prepare(sql).run();
  }

  async count(model: Model<any>): Promise<number> {
    let sql = `SELECT COUNT(*) FROM ${model.name}`;
    return this._prepare(sql).get()['COUNT(*)'] as number;
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
    options = Object.assign({}, {
      shouldCreate: false,
      inMemory: false
    } as DatabaseOpenOptions, options || {});

    if (filename.toLowerCase() === ':memory:') {
      options.inMemory = true;
      filename = 'memdb' + new Date().getTime() + (Math.random() * (10000 - 1) + 1);
    }

    let db = new sqlite(filename, {
      memory: options.inMemory,
      fileMustExist: !options.shouldCreate
    });

    db.exec('PRAGMA foreign_keys = TRUE');
    return new Database(db);
  }

  /** Protected area **/

  protected _db: sqlite;
  protected _models: Model<any>[] = [];
  protected _schemaFlushed: boolean = false;

  protected constructor(db: sqlite) {
    this._db = db;
  }

  protected _logQuery(query: string, bound?: SqlBoundParams|any[]): void {
    console.log('Q:', query, bound == null ? '' : (bound instanceof SqlBoundParams ? bound.sqlBindings : bound));
  }

  protected _whereToQuery<T>(model: Model<T>, whereClause: { [name: string]: any }): SqlQueryParams {
    const expectPlain = (value: any): void => {
      let type = typeof value;
      if (['string', 'number', 'boolean'].indexOf(type) < 0 && value != null) {
        throw new Error('Plain value expected, but got this: ' + value + ' of type ' + type);
      }
    };

    const handleWhere = (rootKey: string, root: any): WhereResult => {
      let result: WhereResult = {
        query: '',
        bound: new SqlBoundParams()
      };

      const aggregateChildren = (obj: any): string[] => {
        let subConditions: string[] = [];
        for (let childKey of Object.keys(obj)) {
          let childWhere = handleWhere(childKey, obj[childKey]);
          subConditions.push(childWhere.query);
          result.bound.merge(childWhere.bound);
        }
        return subConditions;
      };

      if (rootKey.startsWith('$')) {
        // special key
        rootKey = rootKey.toLowerCase();
        if (rootKey === '$and' || rootKey === '$or') {
          // join sub-operators with logical one
          let sqlOperator = rootKey === '$and' ? ' AND ' : ' OR ';
          result.query = aggregateChildren(root).map(x => '(' + x + ')').join(sqlOperator);
        } else {
          throw new Error(`Unknown operator [${rootKey}]`);
        }
      } else {
        // just a value
        if (typeof root === 'object' && root != null) {
          // if it is object, we should inspect it for operators
          let conditions: string[] = [];
          for (let opkey of Object.keys(root)) {
            let childWhere = handleOperator(opkey, rootKey, root[opkey]);
            conditions.push(childWhere.query);
            result.bound.merge(childWhere.bound);
          }
          if (conditions.length === 0) {
            throw new Error(`Invalid empty operator object for field ${rootKey}`);
          } else if (conditions.length === 1) {
            result.query = conditions[0];
          } else {
            result.query = conditions.map(x => '(' + x + ')').join(' AND ');
          }
        } else {
          result.query = rootKey + ' = ' + result.bound.bind(model.getFieldWrapperChecked(rootKey).convertToDatabaseForm(root));
        }
      }

      return result;
    };

    const handleMappedOperator = (mapped: string, left: string, right: any): WhereResult => {
      let fsw = model.getFieldWrapperChecked(left);
      let rightConverted = fsw.convertToDatabaseForm(right);

      expectPlain(rightConverted);
      let bound = new SqlBoundParams();
      return {
        query: left + ' ' + mapped + ' ' + bound.bind(rightConverted),
        bound
      };
    };

    const handleOperator = (operator: string, left: string, right: any): WhereResult => {
      operator = operator.toLowerCase();

      let mappedOperators = mapFromObject<string>({
        ['$eq']: '=',
        ['$like']: 'LIKE',
        ['$gt']: '>',
        ['$lt']: '<',
        ['$gte']: '>=',
        ['$lte']: '<=',
        ['$ne']: '<>',
        ['$glob']: 'GLOB'
      });

      if (mappedOperators.has(operator.toLowerCase())) {
        return handleMappedOperator(mappedOperators.get(operator.toLowerCase()) as string, left, right);
      } else if (operator === '$in' || operator === '$notin') {
        // we expect a list of values here
        if (right.length === 1) {
          return handleMappedOperator(mappedOperators.get(operator === '$in' ? '$eq' : '$ne') as string, left, right[0]);
        } else {
          let bound = new SqlBoundParams();
          let list = (right as any[]).map(x => bound.bind(model.getFieldWrapperChecked(left).convertToDatabaseForm(x)));
          let mapped = operator === '$in' ? 'IN' : 'NOT IN';
          return {
            query: left + ' ' + mapped + ' (' + list.join(', ') + ')',
            bound
          };
        }
      }

      throw new Error(`Invalid operator [${operator}]`);
    };

    let q: SqlQueryParams = {
      where: [],
      bound: new SqlBoundParams()
    };

    for (let key of Object.keys(whereClause)) {
      let childWhere = handleWhere(key, whereClause[key]);
      q.where.push(childWhere.query);
      q.bound.merge(childWhere.bound);
    }

    return q;
  }

  protected _simpleOptionsToQuery<T>(model: Model<T>, options: QueryOptions): SqlQueryParams {
    let q: SqlQueryParams = {
      where: [],
      bound: new SqlBoundParams()
    };

    if (options.where != null) {
      q = Object.assign(q, this._whereToQuery(model, options.where));
    }

    return q;
  }

  protected _findOptionsToQuery<T>(model: Model<T>, options: FindOptions): SqlQueryParams {
    let q: SqlQueryParams = {
      where: [],
      bound: new SqlBoundParams()
    };

    // process search options
    if (options.where != null) {
      q = Object.assign(q, this._whereToQuery(model, options.where));
    }

    const addConstraint = (cr: string): void => {
      if (q.constraints == null) {
        q.constraints = [];
      }
      q.constraints.push(cr);
    };

    const addJoin = (j: string): void => {
      if (q.joins == null) {
        q.joins = [];
      }
      q.joins.push(j);
    };

    if (options.limit != null) {
      addConstraint('LIMIT ' + options.limit);
    }
    if (options.offset != null) {
      addConstraint('OFFSET ' + options.offset);
    }

    // process sorting
    let sortParts: string[] = [];
    let defSorting = model.defaultSorting;
    if (options.sort != null && options.sort.length > 0) {
      // apply specified sorting rules
      for (let sortProp of options.sort) {
        if (typeof sortProp === 'string') {
          if (model.getFieldSpec(sortProp) == null) {
            throw new Error(`Invalid sorting property: no field [${sortProp}]`);
          }
          sortParts.push(this._makeSort(sortProp, SortOrder.Asc, false));
        } else {
          if (model.getFieldSpec(sortProp.by) == null) {
            throw new Error(`Invalid sorting property: no field [${sortProp}]`);
          }
          sortParts.push(this._makeSort(sortProp.by, sortProp.order, sortProp.caseSensitive));
        }
      }

      if (defSorting != null) {
        // check if default sorting option was already used
        if (!options.sort.some(x => {
              return (typeof x === 'string' && x === (defSorting as SortProp).by) ||
                  (typeof x !== 'string' && x.by === (defSorting as SortProp).by);
            })) {
          // if default sorting option was not used, add it to the end
          if (model.getFieldSpec(defSorting.by) == null) {
            throw new Error(`Invalid sorting property: no field [${defSorting.by}]`);
          }
          sortParts.push(this._makeSort(defSorting.by, defSorting.order, defSorting.caseSensitive));
        }
      }
    }

    if (sortParts.length === 0 && defSorting != null) {
      sortParts.push(this._makeSort(defSorting.by, defSorting.order, defSorting.caseSensitive));
    }

    if (sortParts.length > 0) {
      addConstraint('ORDER BY ' + sortParts.join(', '));
    }

    // process joins
    if (options.join && options.join.length > 0) {
      for (let joinOption of options.join) {
        // generate and join sql for joining a table
        let rd = joinOption.relation.relationData;
        let cond = joinOption.relation.getJoinCondition(model, rd.name);
        addJoin(`${joinOption.type} JOIN ${rd.companionModel.name} AS ${rd.name} ON ${cond}`);

        // and we should add extra columns to select joined items as well.
        if (q.extraColumns == null) {
          q.extraColumns = [];
        }
        q.extraColumns.push(...this._makeColumnListForModel(rd.companionModel, rd.name));
      }
    }

    return q;
  }

  protected _makeSort(by: string, order?: SortOrder, caseSensitive?: boolean): string {
    let collation = caseSensitive ? '' : 'COLLATE NOCASE';
    let sortOrder = order === SortOrder.Desc ? 'DESC' : 'ASC';
    return `${by} ${collation} ${sortOrder}`;
  }

  protected _prepare(sql: string, bindings?: SqlBoundParams|any[]) {
    this._logQuery(sql, bindings);
    let prepared = this._db.prepare(sql);
    if (bindings != null) {
      return prepared.bind(bindings instanceof SqlBoundParams ? bindings.sqlBindings : bindings);
    }
    return prepared;
  }

  protected _makeColumnListForModel(model: Model<any>, prefix?: string): string[] {
    let columns: string[] = model.fields.map(fsw => {
      if (prefix) {
        let colName = prefix + '.' + fsw.fieldName;
        return `${colName} AS "${colName}"`;
      } else {
        return fsw.fieldName;
      }
    });

    if (model.fields.find(x => x.fieldSpec.primaryKey === true) == null) {
      let colName = model.name + '.' + ROWID;
      columns.push(`${colName} AS "${colName}"`);
    }

    return columns;
  }

  protected _makeWhere(where: string[]|null|undefined): string {
      if (!where || where.length === 0) {
      return '';
    } else if (where.length === 1) {
      return 'WHERE ' + where[0];
    } else {
      return 'WHERE ' + where.map(x => '(' + x + ')').join(' AND ');
    }
  }
}
