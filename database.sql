DROP TABLE IF EXISTS message;

CREATE TABLE message (
  sender uuid NOT NULL,
  receiver uuid NOT NULL,
  payload varchar(1000000) NOT NULL,
  timestamp bigint NOT NULL,
  PRIMARY KEY(sender, timestamp)
);

CREATE INDEX idx_receiver_timestamp ON message(receiver, timestamp);

DROP TABLE IF EXISTS push_subscription;

CREATE TABLE push_subscription (
  receiver uuid NOT NULL,
  endpoint varchar(1024) NOT NULL,
  PRIMARY KEY(receiver, endpoint)
);
