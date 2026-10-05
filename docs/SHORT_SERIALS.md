# Four-character label serials

Every issued sticker receives a globally unique four-character serial from the uppercase base-36 alphabet `0–9A–Z`. The serial namespace contains `36^4` values (1,679,616). Numbering begins at `A000` and advances through the complete namespace without reuse; after `ZZZZ`, the remaining codes wrap to `0000` through `9ZZZ` exactly once. The QR bearer token and its hash/ciphertext remain independent of this visible identifier.

Migration `0004_short_label_serials.sql` adds `labels.short_serial`, backfills every existing label in stable `(created_at, id)` order, and preserves the existing `labels.serial` values for compatibility with already printed stickers. It changes a linked box name only when it is null, blank, or exactly its generated `Box N` default. Custom names remain intact. The allocator's singleton row stores the next unallocated ordinal.

Batch issuance reserves a contiguous range with one parameterized `UPDATE` inside the batch transaction. The row update serializes concurrent issuers; label rows and the reserved counter commit together. If a batch will exceed capacity, the update reserves nothing, the route creates no batch, and it returns HTTP 409 with `short_serial_exhausted`. A later insert/audit failure rolls the range reservation back with the batch.

Customer box responses expose `labelSerial` and `defaultName`. Label-linked boxes resolve their empty/default name to the short serial; unlabeled legacy boxes retain `Box N`. Admin label responses use the short serial as `serial` and may include the prior value as `legacySerial`; searches match both identifiers. QR artwork uses the short serial as its visible printed identifier.
