DROP TABLE IF EXISTS message;

CREATE TABLE message (
  sender varchar(100) NOT NULL,
  receiver varchar(100) NOT NULL,
  payload varchar(1000000) NOT NULL,
  timestamp bigint NOT NULL,
  PRIMARY KEY(sender, timestamp)
);

CREATE INDEX idx_receiver_timestamp ON message(receiver, timestamp);