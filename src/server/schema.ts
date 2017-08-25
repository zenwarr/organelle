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
    desc TEXT COLLATE NOCASE
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

`;
