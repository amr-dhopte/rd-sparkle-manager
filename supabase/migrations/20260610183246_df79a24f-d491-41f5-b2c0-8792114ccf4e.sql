
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only subscribe to own channel" ON realtime.messages;
CREATE POLICY "Users can only subscribe to own channel"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'rd-sync-' || auth.uid()::text
);
