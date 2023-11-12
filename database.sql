DROP TABLE IF EXISTS message;

CREATE TABLE message (
  sender text NOT NULL,
  receiver text NOT NULL,
  payload text NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(sender, timestamp)
);

CREATE INDEX idx_receiver ON message(receiver);

CREATE INDEX idx_timestamp ON message(timestamp);
