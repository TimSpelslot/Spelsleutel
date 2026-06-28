<script setup lang="ts">
import { ref } from 'vue'

interface Condition {
  name: string
  rules?: string[]
  levels?: string[]
  notes?: string[]
}

const CONDITIONS: Condition[] = [
  {
    name: 'Blinded',
    rules: [
      "Can't see; auto-fails sight-based ability checks.",
      "Attack rolls against it have advantage; its attacks have disadvantage.",
    ],
  },
  {
    name: 'Charmed',
    rules: [
      "Can't attack the charmer or target them with harmful effects.",
      "Charmer has advantage on social ability checks against the creature.",
    ],
  },
  {
    name: 'Deafened',
    rules: ["Can't hear; auto-fails hearing-based ability checks."],
  },
  {
    name: 'Exhaustion',
    levels: [
      '1 — Disadvantage on ability checks',
      '2 — Speed halved',
      '3 — Disadvantage on attack rolls and saving throws',
      '4 — Hit point maximum halved',
      '5 — Speed reduced to 0',
      '6 — Death',
    ],
    notes: ['Long rest reduces level by 1, provided the creature has had food and water.'],
  },
  {
    name: 'Frightened',
    rules: [
      "Disadvantage on ability checks and attack rolls while the source is in line of sight.",
      "Can't willingly move closer to the source.",
    ],
  },
  {
    name: 'Grappled',
    rules: [
      "Speed becomes 0.",
      "Ends if grappler is incapacitated, or creature is moved out of reach.",
    ],
  },
  {
    name: 'Incapacitated',
    rules: ["Can't take actions or reactions."],
  },
  {
    name: 'Invisible',
    rules: [
      "Can't be seen without magic or a special sense.",
      "Attack rolls against it have disadvantage; its attacks have advantage.",
    ],
  },
  {
    name: 'Paralyzed',
    rules: [
      "Incapacitated; can't move or speak.",
      "Auto-fails Str and Dex saving throws.",
      "Attacks against it have advantage.",
      "Any attack is a critical hit if the attacker is within 5 ft.",
    ],
  },
  {
    name: 'Petrified',
    rules: [
      "Transformed to stone; weight ×10, stops aging.",
      "Incapacitated; can't move, speak, or perceive surroundings.",
      "Auto-fails Str and Dex saving throws.",
      "Attacks have advantage; resistance to all damage; immune to poison/disease.",
    ],
  },
  {
    name: 'Poisoned',
    rules: ["Disadvantage on attack rolls and ability checks."],
  },
  {
    name: 'Prone',
    rules: [
      "Can only crawl, or use half movement to stand up.",
      "Disadvantage on attack rolls.",
      "Melee attacks within 5 ft. have advantage; ranged attacks have disadvantage.",
    ],
  },
  {
    name: 'Restrained',
    rules: [
      "Speed becomes 0.",
      "Attacks against it have advantage; its attacks have disadvantage.",
      "Disadvantage on Dexterity saving throws.",
    ],
  },
  {
    name: 'Stunned',
    rules: [
      "Incapacitated; can't move; can only speak falteringly.",
      "Auto-fails Str and Dex saving throws.",
      "Attacks against it have advantage.",
    ],
  },
  {
    name: 'Unconscious',
    rules: [
      "Incapacitated; can't move or speak; unaware of surroundings.",
      "Drops held items; falls prone.",
      "Auto-fails Str and Dex saving throws.",
      "Attacks have advantage; any hit within 5 ft. is a critical hit.",
    ],
  },
]

const selected = ref<Condition>(CONDITIONS[0])
</script>

<template>
  <div class="cond">
    <div class="cond__list">
      <button
        v-for="c in CONDITIONS"
        :key="c.name"
        class="cond__item"
        :class="{ 'cond__item--active': selected.name === c.name }"
        @click="selected = c"
      >
        {{ c.name }}
      </button>
    </div>

    <div class="cond__detail">
      <p class="cond__name">{{ selected.name }}</p>

      <template v-if="selected.levels">
        <ul class="cond__rules">
          <li v-for="(lvl, i) in selected.levels" :key="i" class="cond__rule">{{ lvl }}</li>
        </ul>
        <ul v-if="selected.notes" class="cond__rules cond__rules--note">
          <li v-for="(note, i) in selected.notes" :key="i" class="cond__rule">{{ note }}</li>
        </ul>
      </template>

      <ul v-else class="cond__rules">
        <li v-for="(rule, i) in selected.rules" :key="i" class="cond__rule">{{ rule }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.cond {
  display: grid;
  grid-template-columns: 108px 1fr;
  height: 100%;
  overflow: hidden;
}

.cond__list {
  border-right: 1px solid var(--ss-border);
  overflow-y: auto;
  background: var(--ss-surface);
  display: flex;
  flex-direction: column;
  padding: 0.2rem 0;
  scrollbar-width: thin;
}

.cond__item {
  padding: 0.32rem 0.6rem;
  font-size: 0.71rem;
  font-weight: 500;
  text-align: left;
  background: none;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  color: var(--ss-text-muted);
  transition: color 0.1s, background 0.1s;
  white-space: nowrap;
}

.cond__item:hover {
  background: color-mix(in srgb, var(--ss-primary) 8%, transparent);
  color: var(--ss-text);
}

.cond__item--active {
  color: var(--ss-primary);
  border-left-color: var(--ss-primary);
  font-weight: 700;
  background: color-mix(in srgb, var(--ss-primary) 10%, transparent);
}

.cond__detail {
  padding: 0.75rem 0.8rem;
  overflow-y: auto;
}

.cond__name {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 0.55rem;
}

.cond__rules {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.cond__rule {
  font-size: 0.72rem;
  line-height: 1.45;
  color: var(--ss-text-muted);
  padding-left: 0.8rem;
  position: relative;
}

.cond__rule::before {
  content: '▸';
  position: absolute;
  left: 0;
  color: var(--ss-primary);
  font-size: 0.6rem;
  top: 0.18em;
}

.cond__rules--note {
  margin-top: 0.6rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--ss-border);
}

.cond__rules--note .cond__rule::before {
  content: '★';
  font-size: 0.55rem;
  top: 0.22em;
}
</style>
