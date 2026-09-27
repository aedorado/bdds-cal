-- "Ksaya tithi: Sasti -- 2 Sep 06:14 to 3 Sep 04:27 (LT)" is an astronomical
-- note about a skipped lunar day, not an observance. Importing those as
-- festivals put something on almost every square of the calendar.

alter type festival_kind add value if not exists 'note';

-- Run the reclassify in a separate statement: a new enum value cannot be used
-- in the same transaction that added it.
