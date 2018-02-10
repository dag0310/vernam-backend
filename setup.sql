drop table if exists messages;
drop table if exists users;

create table users (
  phone_number text not null primary key,
  auth_token text not null
);
create table messages (
  id serial not null primary key,
  sender text not null references users (phone_number) on delete cascade,
  receiver text not null references users (phone_number) on delete cascade,
  payload text not null,
  timestamp timestamp not null default current_timestamp
);
