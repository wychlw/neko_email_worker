drop table if exists users;
create table if not exists users (
    username text primary key,
    password text not null,
    token text not null
);

drop table if exists meta;
create table if not exists meta (
    token text primary key,
    is_admin boolean not null default 0,
    mail_num integer not null default 0,
    mail_size integer not null default 0
);