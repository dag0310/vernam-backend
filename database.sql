DROP TABLE IF EXISTS message;

CREATE TABLE message (
  sender varchar(100) NOT NULL,
  receiver varchar(100) NOT NULL,
  payload varchar(1000000) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(sender, timestamp)
);

CREATE INDEX idx_receiver ON message(receiver);

CREATE INDEX idx_timestamp ON message(timestamp);
