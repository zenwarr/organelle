export const schema: string = `
CREATE TABLE resources(
    uuid TEXT PRIMARY KEY,
    title TEXT NOT NULL COLLATE NOCASE,
    title_sort TEXT NOT NULL COLLATE NOCASE,
    rating SMALLINT,
    add_date DATETIME,
    last_modify_date DATETIME,
    publish_date TEXT COLLATE NOCASE,
    publisher TEXT COLLATE NOCASE,
    desc TEXT COLLATE NOCASE,
    am_groups TEXT NOT NULL,
    am_persons TEXT NOT NULL
);

CREATE TABLE persons(
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE,
    name_sort TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE res_to_persons(
    res_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    relation INTEGER NOT NULL,
    UNIQUE(res_id, person_id, relation),
    FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT,
    FOREIGN KEY(person_id) REFERENCES persons(uuid) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE group_types(
    uuid TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL COLLATE NOCASE,
    exclusive BOOLEAN NOT NULL,
    ordered BOOLEAN NOT NULL
);

CREATE TABLE groups(
    uuid TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL COLLATE NOCASE,
    title_sort TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE res_to_groups(
    res_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    group_index INTEGER NOT NULL,
    relation_tag TEXT NOT NULL COLLATE NOCASE DEFAULT '',
    UNIQUE(res_id, group_id, group_index, relation_tag),
    FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT,
    FOREIGN KEY(group_id) REFERENCES groups(uuid) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE TABLE objects(
    id INTEGER PRIMARY KEY,
    res_id TEXT NOT NULL,
    uuid TEXT NOT NULL,
    role INTEGER NOT NULL,
    tag TEXT COLLATE NOCASE,
    UNIQUE(res_id, uuid, role, tag),
    FOREIGN KEY(res_id) REFERENCES resources(uuid) ON DELETE CASCADE ON UPDATE RESTRICT
);

CREATE VIEW res_to_groups_view AS
    SELECT title, title_sort, type, group_index, relation_tag, res_id, group_id AS linked_id FROM groups
        LEFT JOIN res_to_groups ON groups.uuid = group_id;

CREATE VIEW res_to_persons_view AS
    SELECT name, name_sort, relation, res_id, person_id AS linked_id FROM persons
        LEFT JOIN res_to_persons ON persons.uuid = person_id;
        
CREATE TRIGGER update_groups_amalgama_ug AFTER UPDATE OF name, uuid ON groups
  BEGIN
    UPDATE resources SET am_groups = (
      SELECT coalesce(group_concat(groups.title || '@' || type, '|'), '') FROM groups
      WHERE groups.uuid IN (SELECT group_id FROM res_to_groups WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (
      SELECT res_id FROM res_to_groups WHERE group_id in (new.uuid, old.uuid)
    );
  END;
  
CREATE TRIGGER update_groups_amalgama_dg AFTER DELETE ON groups
  BEGIN
    UPDATE resources SET am_groups = (
      SELECT coalesce(group_concat(groups.title || '@' || type, '|'), '') FROM groups
      WHERE groups.uuid IN (SELECT group_id FROM res_to_groups WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (
      SELECT res_id FROM res_to_groups WHERE group_id = old.uuid
    );
  END;
  
CREATE TRIGGER update_groups_amalgama_ig AFTER INSERT ON groups
  BEGIN
    UPDATE resources SET am_groups = (
      SELECT coalesce(group_concat(groups.title || '@' || type, '|'), '') FROM groups
      WHERE groups.uuid IN (SELECT group_id FROM res_to_groups WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (
      SELECT res_id FROM res_to_groups WHERE group_id = new.uuid
    );
  END;
  
CREATE TRIGGER update_groups_amalgama_ugr AFTER UPDATE OF res_id, group_id ON res_to_groups
  BEGIN
    UPDATE resources SET am_groups = (
      SELECT coalesce(group_concat(groups.title || '@' || type, '|'), '') FROM groups
      WHERE groups.uuid IN (SELECT group_id FROM res_to_groups WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (new.res_id, old.res_id);
  END;
  
CREATE TRIGGER update_groups_amalgama_igr AFTER INSERT ON res_to_groups
  BEGIN
    UPDATE resources SET am_groups = (
      SELECT coalesce(group_concat(groups.title || '@' || type, '|'), '') FROM groups
      WHERE groups.uuid IN (SELECT group_id FROM res_to_groups WHERE res_id = resources.uuid)
    ) WHERE resources.uuid = new.res_id;
  END;
  
CREATE TRIGGER update_groups_amalgama_dgr AFTER DELETE ON res_to_groups
  BEGIN
    UPDATE resources SET am_groups = (
      SELECT coalesce(group_concat(groups.title || '@' || type, '|'), '') FROM groups
      WHERE groups.uuid IN (SELECT group_id FROM res_to_groups WHERE res_id = resources.uuid)
    ) WHERE resources.uuid = old.res_id;
  END;
  
CREATE TRIGGER update_persons_amalgama_ug AFTER UPDATE OF name, uuid ON persons
  BEGIN
    UPDATE resources SET am_persons = (
      SELECT coalesce(group_concat(name || '@' || relation, '|'), '') FROM persons
      LEFT JOIN res_to_persons ON person_id = persons.uuid
      WHERE persons.uuid IN (SELECT person_id FROM res_to_persons WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (
      SELECT res_id FROM res_to_persons WHERE person_id in (new.uuid, old.uuid)
    );
  END;
  
CREATE TRIGGER update_persons_amalgama_dg AFTER DELETE ON persons
  BEGIN
    UPDATE resources SET am_persons = (
      SELECT coalesce(group_concat(name || '@' || relation, '|'), '') FROM persons
      LEFT JOIN res_to_persons ON person_id = persons.uuid
      WHERE persons.uuid IN (SELECT person_id FROM res_to_persons WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (
      SELECT res_id FROM res_to_persons WHERE person_id = old.uuid
    );
  END;
  
CREATE TRIGGER update_persons_amalgama_ig AFTER INSERT ON persons
  BEGIN
    UPDATE resources SET am_persons = (
      SELECT coalesce(group_concat(name || '@' || relation, '|'), '') FROM persons
      LEFT JOIN res_to_persons ON person_id = persons.uuid
      WHERE persons.uuid IN (SELECT person_id FROM res_to_persons WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (
      SELECT res_id FROM res_to_persons WHERE person_id = new.uuid
    );
  END;
  
CREATE TRIGGER update_persons_amalgama_ugr AFTER UPDATE OF res_id, person_id ON res_to_persons
  BEGIN
    UPDATE resources SET am_persons = (
      SELECT coalesce(group_concat(name || '@' || relation, '|'), '') FROM persons
      LEFT JOIN res_to_persons ON person_id = persons.uuid
      WHERE persons.uuid IN (SELECT person_id FROM res_to_persons WHERE res_id = resources.uuid)
    ) WHERE resources.uuid IN (new.res_id, old.res_id);
  END;
  
CREATE TRIGGER update_persons_amalgama_igr AFTER INSERT ON res_to_persons
  BEGIN
    UPDATE resources SET am_persons = (
      SELECT coalesce(group_concat(name || '@' || relation, '|'), '') FROM persons
      LEFT JOIN res_to_persons ON person_id = persons.uuid
      WHERE persons.uuid IN (SELECT person_id FROM res_to_persons WHERE res_id = resources.uuid)
    ) WHERE resources.uuid = new.res_id;
  END;
  
CREATE TRIGGER update_persons_amalgama_dgr AFTER DELETE ON res_to_persons
  BEGIN
    UPDATE resources SET am_persons = (
      SELECT coalesce(group_concat(name || '@' || relation, '|'), '') FROM persons
      LEFT JOIN res_to_persons ON person_id = persons.uuid
      WHERE persons.uuid IN (SELECT person_id FROM res_to_persons WHERE res_id = resources.uuid)
    ) WHERE resources.uuid = old.res_id;
  END;

`;
