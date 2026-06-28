<script setup lang="ts">
import { ref } from 'vue'

type Tab = 'actions' | 'cover' | 'wildmagic'
const activeTab = ref<Tab>('actions')

// ── Combat Actions ────────────────────────────────────────────────────────

interface Action {
  name: string
  desc: string
  sub?: { name: string; desc: string }[]
  tag?: string
}

const ACTIONS: Action[] = [
  {
    name: 'Attack',
    tag: 'Action',
    desc: 'Make one melee or ranged weapon attack. You can replace one attack with a Grapple or Shove.',
    sub: [
      { name: 'Grapple', desc: 'Athletics vs. target's Athletics or Acrobatics. Success → target is Grappled.' },
      { name: 'Shove', desc: 'Athletics vs. target's Athletics or Acrobatics. Success → knock prone or push 5 ft.' },
    ],
  },
  { name: 'Cast a Spell', tag: 'Action', desc: 'Cast a spell with a casting time of 1 action.' },
  { name: 'Dash', tag: 'Action', desc: 'Gain extra movement equal to your speed (after modifiers) until end of turn.' },
  { name: 'Disengage', tag: 'Action', desc: 'Movement doesn\'t provoke opportunity attacks for the rest of the turn.' },
  { name: 'Dodge', tag: 'Action', desc: 'Attacks against you have disadvantage (if you can see attacker). Advantage on Dex saves. Lost if incapacitated or speed is 0.' },
  { name: 'Help', tag: 'Action', desc: 'Ally gains advantage on next ability check, or you grant advantage on next attack roll against a creature within 5 ft.' },
  { name: 'Hide', tag: 'Action', desc: 'Dexterity (Stealth) vs. passive Perception of each creature that might notice you.' },
  { name: 'Ready', tag: 'Action', desc: 'Choose a trigger and a reaction. On the trigger, use your reaction to take the readied action.' },
  { name: 'Search', tag: 'Action', desc: 'Devote attention to finding something — Perception (for hidden things) or Investigation (for clues).' },
  { name: 'Use an Object', tag: 'Action', desc: 'Use a second object. (You can interact with one object for free per turn.)' },
  { name: 'Opportunity Attack', tag: 'Reaction', desc: 'When a hostile creature you can see moves out of your melee reach.' },
  { name: 'Readied Action', tag: 'Reaction', desc: 'Take the action you readied when the specified trigger occurs.' },
]

// ── Cover & Vision ────────────────────────────────────────────────────────

interface CoverRow { type: string; bonus: string; examples: string }

const COVER: CoverRow[] = [
  { type: 'Half Cover', bonus: '+2 AC, +2 Dex saves', examples: 'Low wall, another creature, table edge' },
  { type: '¾ Cover', bonus: '+5 AC, +5 Dex saves', examples: 'Portcullis, arrow slit, thick tree trunk' },
  { type: 'Total Cover', bonus: 'Can\'t be targeted', examples: 'Completely concealed' },
]

interface VisionRow { type: string; effect: string }

const VISION: VisionRow[] = [
  { type: 'Bright Light', effect: 'Normal vision' },
  { type: 'Dim Light', effect: 'Lightly obscured — disadvantage on Perception (sight)' },
  { type: 'Darkness', effect: 'Heavily obscured — treat as Blinded' },
  { type: 'Darkvision', effect: 'Darkness as dim light (monochrome), dim as bright' },
  { type: 'Blindsight', effect: 'No sight needed within range; no Stealth advantage' },
  { type: 'Truesight', effect: 'See through darkness, invisibility, illusions, shapeshifters' },
]

// ── Wild Magic Surge ──────────────────────────────────────────────────────

interface SurgeEntry { n: string; effect: string }

const WILD_MAGIC: SurgeEntry[] = [
  { n: '01–02', effect: 'Roll on this table at the start of each of your turns for the next minute, ignoring this result on subsequent rolls.' },
  { n: '03–04', effect: 'For the next minute, you can see any invisible creature if you have line of sight to it.' },
  { n: '05–06', effect: 'A modron chosen and controlled by the DM appears in an unoccupied space within 5 feet of you, then disappears 1 minute later.' },
  { n: '07–08', effect: 'You cast fireball as a 3rd-level spell centered on yourself.' },
  { n: '09–10', effect: 'You cast magic missile as a 5th-level spell.' },
  { n: '11–12', effect: 'Roll a d10. Your height changes by a number of inches equal to the roll. If odd, you shrink. If even, you grow.' },
  { n: '13–14', effect: 'You cast confusion centered on yourself.' },
  { n: '15–16', effect: 'For the next minute, you regain 5 hit points at the start of each of your turns.' },
  { n: '17–18', effect: 'You grow a long beard made of feathers that remains until you sneeze, at which point the feathers explode out from your face.' },
  { n: '19–20', effect: 'You cast grease centered on yourself.' },
  { n: '21–22', effect: 'Creatures have disadvantage on saving throws against the next spell you cast in the next minute that involves a saving throw.' },
  { n: '23–24', effect: 'Your skin turns a vibrant shade of blue. A remove curse spell can end this effect.' },
  { n: '25–26', effect: 'An eye appears on your forehead for the next minute. During that time, you have advantage on Wisdom (Perception) checks that rely on sight.' },
  { n: '27–28', effect: 'For the next minute, all your spells with a casting time of 1 action have a casting time of 1 bonus action.' },
  { n: '29–30', effect: 'You teleport up to 60 feet to an unoccupied space of your choice that you can see.' },
  { n: '31–32', effect: 'You are transported to the Astral Plane until the end of your next turn, after which time you return to the space you previously occupied or the nearest unoccupied space.' },
  { n: '33–34', effect: 'Maximize the damage of the next damaging spell you cast within the next minute.' },
  { n: '35–36', effect: 'Roll a d10. Your age changes by that many years — odd: younger (min 1), even: older.' },
  { n: '37–38', effect: '1d6 flumphs controlled by the DM appear within 60 feet of you, frightened of you. They vanish after 1 minute.' },
  { n: '39–40', effect: 'You regain 2d10 hit points.' },
  { n: '41–42', effect: 'You turn into a potted plant until the start of your next turn. Incapacitated and vulnerable to all damage; if you drop to 0 HP the pot breaks and you revert.' },
  { n: '43–44', effect: 'For the next minute, you can teleport up to 20 feet as a bonus action on each of your turns.' },
  { n: '45–46', effect: 'You cast levitate on yourself.' },
  { n: '47–48', effect: 'A unicorn controlled by the DM appears in a space within 5 feet of you, then disappears 1 minute later.' },
  { n: '49–50', effect: "You can't speak for the next minute. Whenever you try, pink bubbles float out of your mouth." },
  { n: '51–52', effect: 'A spectral shield hovers near you for the next minute: +2 AC and immunity to magic missile.' },
  { n: '53–54', effect: 'You are immune to being intoxicated by alcohol for the next 5d6 days.' },
  { n: '55–56', effect: 'Your hair falls out but grows back within 24 hours.' },
  { n: '57–58', effect: "For the next minute, any flammable object you touch that isn't being worn or carried bursts into flame." },
  { n: '59–60', effect: 'You regain your lowest-level expended spell slot.' },
  { n: '61–62', effect: 'For the next minute, you must shout when you speak.' },
  { n: '63–64', effect: 'You cast fog cloud centered on yourself.' },
  { n: '65–66', effect: 'Up to three creatures you choose within 30 feet of you take 4d10 lightning damage.' },
  { n: '67–68', effect: 'You are frightened by the nearest creature until the end of your next turn.' },
  { n: '69–70', effect: 'Each creature within 30 feet of you becomes invisible until the end of your next turn. Invisibility ends when a creature attacks or casts a spell.' },
  { n: '71–72', effect: 'You gain resistance to all damage for the next minute.' },
  { n: '73–74', effect: 'A random creature within 60 feet of you becomes poisoned for 1d4 hours.' },
  { n: '75–76', effect: 'You glow with bright light in a 30-foot radius for the next minute. Any creature that ends its turn within 5 feet of you is blinded until the end of its next turn.' },
  { n: '77–78', effect: "You cast polymorph on yourself. If you fail the saving throw, you turn into a sheep for the spell's duration." },
  { n: '79–80', effect: 'Illusory butterflies and flower petals flutter in the air within 10 feet of you for the next minute.' },
  { n: '81–82', effect: 'You can take one additional action immediately.' },
  { n: '83–84', effect: 'Each creature within 30 feet of you takes 1d10 necrotic damage. You regain HP equal to the sum of the necrotic damage dealt.' },
  { n: '85–86', effect: 'You cast mirror image.' },
  { n: '87–88', effect: 'You cast fly on a random creature within 60 feet of you.' },
  { n: '89–90', effect: 'You become invisible until the end of your next turn or until you attack or cast a spell.' },
  { n: '91–92', effect: 'If you die within the next minute, you immediately come back to life as if by the reincarnate spell.' },
  { n: '93–94', effect: 'Your size increases by one size category for the next minute.' },
  { n: '95–96', effect: 'You and all creatures within 30 feet of you gain vulnerability to piercing damage for the next minute.' },
  { n: '97–98', effect: 'You are surrounded by faint, ethereal music for the next minute.' },
  { n: '99–00', effect: 'You regain all expended sorcery points.' },
]

interface SurgeRoll { n: string; effect: string }
const surgeHistory = ref<SurgeRoll[]>([])

function rollSurge() {
  const idx = Math.floor(Math.random() * WILD_MAGIC.length)
  surgeHistory.value.unshift(WILD_MAGIC[idx])
  if (surgeHistory.value.length > 5) surgeHistory.value.pop()
}
</script>

<template>
  <div class="ref">
    <!-- Tab bar -->
    <div class="ref__tabs">
      <button
        v-for="tab in (['actions', 'cover', 'wildmagic'] as Tab[])"
        :key="tab"
        class="ref__tab"
        :class="{ 'ref__tab--active': activeTab === tab }"
        @click="activeTab = tab"
      >
        {{ tab === 'actions' ? 'Actions' : tab === 'cover' ? 'Cover' : 'Wild Magic' }}
      </button>
    </div>

    <!-- Actions -->
    <div v-if="activeTab === 'actions'" class="ref__body">
      <div v-for="a in ACTIONS" :key="a.name" class="ref__action">
        <div class="ref__action-header">
          <span class="ref__action-name">{{ a.name }}</span>
          <span v-if="a.tag" class="ref__action-tag" :class="`ref__action-tag--${a.tag.toLowerCase()}`">
            {{ a.tag }}
          </span>
        </div>
        <p class="ref__action-desc">{{ a.desc }}</p>
        <div v-if="a.sub" class="ref__action-sub">
          <div v-for="s in a.sub" :key="s.name" class="ref__sub-entry">
            <span class="ref__sub-name">{{ s.name }}:</span>
            {{ s.desc }}
          </div>
        </div>
      </div>
    </div>

    <!-- Cover & Vision -->
    <div v-else-if="activeTab === 'cover'" class="ref__body">
      <p class="ref__section-label">Cover</p>
      <table class="ref__table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Bonus</th>
            <th>Examples</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in COVER" :key="row.type">
            <td class="ref__td-type">{{ row.type }}</td>
            <td class="ref__td-bonus">{{ row.bonus }}</td>
            <td>{{ row.examples }}</td>
          </tr>
        </tbody>
      </table>

      <p class="ref__section-label ref__section-label--gap">Vision & Light</p>
      <table class="ref__table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Effect</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in VISION" :key="row.type">
            <td class="ref__td-type">{{ row.type }}</td>
            <td>{{ row.effect }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Wild Magic -->
    <div v-else class="ref__body ref__body--surge">
      <button class="ref__surge-btn" @click="rollSurge">
        <i class="pi pi-star" />
        Roll Wild Magic Surge
      </button>

      <div v-if="surgeHistory.length === 0" class="ref__surge-empty">
        <i class="pi pi-circle" />
        No surges yet
      </div>

      <div v-for="(roll, i) in surgeHistory" :key="i" class="ref__surge-result" :class="{ 'ref__surge-result--latest': i === 0 }">
        <span class="ref__surge-n">{{ roll.n }}</span>
        <p class="ref__surge-effect">{{ roll.effect }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ref {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* Tab bar */
.ref__tabs {
  display: flex;
  border-bottom: 1px solid var(--ss-border);
  background: var(--ss-surface);
  flex-shrink: 0;
}

.ref__tab {
  flex: 1;
  padding: 0.4rem 0.3rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  color: var(--ss-text-muted);
  transition: color 0.1s, border-color 0.1s;
}

.ref__tab:hover {
  color: var(--ss-text);
}

.ref__tab--active {
  color: var(--ss-primary);
  border-bottom-color: var(--ss-primary);
}

/* Shared body */
.ref__body {
  flex: 1;
  overflow-y: auto;
  padding: 0.6rem 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  scrollbar-width: thin;
}

/* Actions */
.ref__action {
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--ss-border-subtle);
}

.ref__action:last-child {
  border-bottom: none;
}

.ref__action-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.2rem;
}

.ref__action-name {
  font-size: 0.77rem;
  font-weight: 700;
  color: var(--ss-text);
}

.ref__action-tag {
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.ref__action-tag--action {
  background: color-mix(in srgb, var(--ss-primary) 15%, transparent);
  color: var(--ss-primary);
}

.ref__action-tag--reaction {
  background: color-mix(in srgb, var(--ss-info) 15%, transparent);
  color: var(--ss-info);
}

.ref__action-desc {
  font-size: 0.71rem;
  line-height: 1.45;
  color: var(--ss-text-muted);
  margin: 0;
}

.ref__action-sub {
  margin-top: 0.3rem;
  padding-left: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  border-left: 2px solid color-mix(in srgb, var(--ss-primary) 30%, transparent);
}

.ref__sub-entry {
  font-size: 0.69rem;
  line-height: 1.4;
  color: var(--ss-text-muted);
}

.ref__sub-name {
  font-weight: 700;
  color: var(--ss-text);
}

/* Cover / Vision tables */
.ref__section-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-primary);
  margin: 0;
}

.ref__section-label--gap {
  margin-top: 0.4rem;
}

.ref__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
}

.ref__table th {
  text-align: left;
  padding: 0.25rem 0.4rem;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ss-text-muted);
  border-bottom: 1px solid var(--ss-border);
}

.ref__table td {
  padding: 0.28rem 0.4rem;
  color: var(--ss-text-muted);
  border-bottom: 1px solid var(--ss-border-subtle);
  line-height: 1.35;
  vertical-align: top;
}

.ref__table tr:last-child td {
  border-bottom: none;
}

.ref__td-type {
  font-weight: 700;
  color: var(--ss-text);
  white-space: nowrap;
}

.ref__td-bonus {
  white-space: nowrap;
  color: var(--ss-primary);
  font-weight: 600;
}

/* Wild Magic */
.ref__body--surge {
  gap: 0.6rem;
}

.ref__surge-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.6rem;
  font-size: 0.82rem;
  font-weight: 700;
  background: var(--ss-primary);
  color: var(--ss-primary-fg);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.ref__surge-btn:hover {
  opacity: 0.88;
}

.ref__surge-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  flex: 1;
}

.ref__surge-result {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: 5px;
  padding: 0.5rem 0.65rem;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.ref__surge-result--latest {
  opacity: 1;
  border-color: color-mix(in srgb, var(--ss-primary) 40%, transparent);
  background: color-mix(in srgb, var(--ss-primary) 5%, var(--ss-surface));
}

.ref__surge-n {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--ss-primary);
  font-variant-numeric: tabular-nums;
}

.ref__surge-effect {
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--ss-text-muted);
  margin: 0.15rem 0 0;
}

.ref__surge-result--latest .ref__surge-effect {
  color: var(--ss-text);
}
</style>
