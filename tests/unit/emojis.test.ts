import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMOJI_DEFS, EMOJI_KEYS, e, withEmoji, componentEmoji, updateEmojiAvailability, isEmojiAvailable } from '../../src/config/emojis.js';

const SUPPLIED = `<:ss_ai:1571106585047207966>
<:ss_ai_detect:1571107765483475025>
<:ss_appeal:1571108056870428772>
<:ss_back:1571107312922267739>
<:ss_ban:1571107987735449720>
<:ss_bot:1571107405411000360>
<:ss_channel:1571107597317181624>
<:ss_command:1571107617315491982>
<:ss_delete:1571108294872010763>
<:ss_disabled:1571107268961898506>
<:ss_edit:1571107010374537226>
<:ss_enabled:1571107262938878022>
<:ss_error:1571107080641847337>
<:ss_history:1571108274575642765>
<:ss_home:1571107370803789896>
<:ss_info:1571107196547375154>
<:ss_join:1571108132241801277>
<:ss_kick:1571108046271152148>
<:ss_leave:1571108161409253406>
<:ss_lock:1571107639696298004>
<:ss_logo:1571106376019615795>
<:ss_logs:1571108078387069019>
<:ss_message:1571108079733571604>
<:ss_mute:1571107962741596180>
<:ss_refresh:1571107290155589712>
<:ss_reset:1571108320637485136>
<:ss_role:1571107470158471198>
<:ss_save:1571108310495531068>
<:ss_settings:1571106977440989234>
<:ss_shield:1571106837422411776>
<:ss_staff:1571107440592683089>
<:ss_stats:1571108239364456458>
<:ss_success:1571107049847259276>
<:ss_ticket:1571109756523913257>
<:ss_unclock:1571107678464245760>
<:ss_user:1571107408821096589>
<:ss_voice:1571108201104150608>
<:ss_warn:1571107940918624336>
<:ss_warning:1571107162590281738>
<:ss_words:1571107806021558394>`.split('\n');

test('exactly 40 emojis with the exact supplied names and IDs', () => {
  assert.equal(SUPPLIED.length, 40);
  assert.equal(EMOJI_KEYS.length, 40);
  const mine = new Set(EMOJI_KEYS.map((k) => `<:${EMOJI_DEFS[k].name}:${EMOJI_DEFS[k].id}>`));
  assert.deepEqual([...mine].sort(), [...SUPPLIED].sort());
});
test('e() renders the exact markup; unavailable emojis degrade to nothing (never Unicode)', () => {
  assert.equal(e('ban'), '<:ss_ban:1571107987735449720>');
  assert.equal(e('unlock'), '<:ss_unclock:1571107678464245760>');
  const missing = updateEmojiAvailability((id) => id !== EMOJI_DEFS.ban.id);
  assert.deepEqual(missing, ['ban']);
  assert.equal(isEmojiAvailable('ban'), false);
  assert.equal(e('ban'), '');
  assert.equal(withEmoji('ban', 'Ban'), 'Ban');
  assert.equal(componentEmoji('ban'), undefined);
  assert.deepEqual(componentEmoji('kick'), { id: '1571108046271152148', name: 'ss_kick', animated: false });
  updateEmojiAvailability(() => true);
  assert.equal(withEmoji('ban', 'Ban'), '<:ss_ban:1571107987735449720> Ban');
});
