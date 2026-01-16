-- SQL to deduplicate leads by phone number, keeping only the most recent one
-- This script also reassigns messages to the lead that will be kept before deleting duplicates.

WITH MostRecentContacts AS (
    SELECT id, phone, ROW_NUMBER() OVER (PARTITION BY phone ORDER BY last_message_at DESC, created_at DESC) as rank
    FROM public.contacts
),
ContactsToKeep AS (
    SELECT id, phone FROM MostRecentContacts WHERE rank = 1
),
ContactsToDelete AS (
    SELECT id, phone FROM MostRecentContacts WHERE rank > 1
)
-- 1. Reassign messages from duplicate contacts to the kept contact
UPDATE public.messages m
SET contact_id = k.id
FROM ContactsToDelete d
JOIN ContactsToKeep k ON d.phone = k.phone
WHERE m.contact_id = d.id;

-- 2. Delete the duplicate contacts
DELETE FROM public.contacts
WHERE id IN (SELECT id FROM ContactsToDelete);
