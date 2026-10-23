/**
 * Incremental parser for the coach SSE stream.
 * A trailing incomplete block stays in the buffer until the next chunk.
 * @param {string} buffer
 * @param {(event: string, data: object) => void} onEvent
 * @returns {string}
 */
export function consumeCoachSse(buffer, onEvent) {
  const parts = buffer.split('\n\n');
  const rest = parts.pop() ?? '';
  for (const block of parts) {
    const trimmed = block.trim();
    if (!trimmed || trimmed.startsWith(':')) continue;
    let event = 'message';
    const data = [];
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (data.length === 0) continue;
    try {
      onEvent(event, JSON.parse(data.join('\n')));
    } catch {
      onEvent('error', { message: 'The coach stream was malformed.' });
    }
  }
  return rest;
}
