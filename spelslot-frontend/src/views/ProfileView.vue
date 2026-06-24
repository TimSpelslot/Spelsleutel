<script setup lang="ts">
import { ref, computed } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/authService'
import { ddbService, type DdbCharacter } from '@/services/ddbService'

const auth = useAuthStore()
const user = computed(() => auth.user)

// ── Display name editing ───────────────────────────────────────────────────

const editingName = ref(false)
const nameInput = ref('')
const nameSaving = ref(false)
const nameError = ref<string | null>(null)

function startEditName() {
  nameInput.value = user.value?.displayName ?? user.value?.name ?? ''
  nameError.value = null
  editingName.value = true
}

function cancelEditName() {
  editingName.value = false
  nameError.value = null
}

async function saveName() {
  if (!nameInput.value.trim()) return
  nameSaving.value = true
  nameError.value = null
  const result = await auth.updateProfile(nameInput.value.trim())
  nameSaving.value = false
  if (result.type === 'ok') {
    editingName.value = false
  } else {
    nameError.value = result.message
  }
}

// ── Worldbuilder request ───────────────────────────────────────────────────

const wbRequesting = ref(false)
const wbError = ref<string | null>(null)

async function requestWorldbuilder() {
  wbRequesting.value = true
  wbError.value = null
  const result = await authService.requestWorldbuilder()
  wbRequesting.value = false
  if (result.type === 'ok') {
    auth.user = result.data
  } else {
    wbError.value = result.message
  }
}

// ── DnD Beyond character ──────────────────────────────────────────────────

const ddbCharacter = ref<DdbCharacter | null>(null)
const ddbLoading = ref(false)
const ddbError = ref<string | null>(null)

async function syncDdb() {
  const id = user.value?.dndbeyondCharacterId
  if (!id) return
  ddbLoading.value = true
  ddbError.value = null
  const result = await ddbService.refreshCharacter(id)
  ddbLoading.value = false
  if (result.type === 'ok') ddbCharacter.value = result.data.character
  else ddbError.value = result.message
}

// Auto-load if character ID is set
if (auth.user?.dndbeyondCharacterId) {
  ddbLoading.value = true
  ddbService.getCharacter(auth.user.dndbeyondCharacterId).then((r) => {
    ddbLoading.value = false
    if (r.type === 'ok') ddbCharacter.value = r.data.character
    else ddbError.value = r.message
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────

const userInitials = computed(() => {
  const name = user.value?.displayName ?? user.value?.name ?? ''
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
})

const ROLE_LABEL: Record<string, string> = {
  PLAYER: 'Player',
  DM: 'Dungeon Master',
  ADMIN: 'Admin',
}

const ROLE_SEVERITY: Record<string, string> = {
  PLAYER: 'secondary',
  DM: 'warn',
  ADMIN: 'danger',
}
</script>

<template>
  <div class="profile-view">
    <h1 class="profile-view__title">Profile</h1>

    <div v-if="user" class="profile-sections">

      <!-- ── Identity ── -->
      <section class="profile-card">
        <h2 class="profile-card__heading">Account</h2>

        <div class="profile-identity">
          <Avatar
            :image="user.avatarUrl ?? undefined"
            :label="user.avatarUrl ? undefined : userInitials"
            shape="circle"
            size="xlarge"
            class="profile-identity__avatar"
          />

          <div class="profile-identity__info">
            <!-- Display name -->
            <div class="profile-field">
              <span class="profile-field__label">Display name</span>
              <div v-if="!editingName" class="profile-field__value-row">
                <span class="profile-field__value">{{ user.displayName || user.name }}</span>
                <button class="profile-inline-btn" @click="startEditName">
                  <i class="pi pi-pencil" /> Edit
                </button>
              </div>
              <div v-else class="profile-field__edit-row">
                <InputText
                  v-model="nameInput"
                  size="small"
                  class="profile-name-input"
                  @keyup.enter="saveName"
                  @keyup.escape="cancelEditName"
                />
                <Button
                  label="Save"
                  size="small"
                  :loading="nameSaving"
                  @click="saveName"
                />
                <Button
                  label="Cancel"
                  size="small"
                  text
                  severity="secondary"
                  @click="cancelEditName"
                />
              </div>
              <p v-if="nameError" class="profile-field__error">{{ nameError }}</p>
              <p class="profile-field__hint">
                This name is shown to other players. Your Google account name is
                <strong>{{ user.name }}</strong>.
              </p>
            </div>

            <!-- Email -->
            <div class="profile-field">
              <span class="profile-field__label">Email</span>
              <span class="profile-field__value profile-field__value--muted">{{ user.email }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Role & access ── -->
      <section class="profile-card">
        <h2 class="profile-card__heading">Role &amp; access</h2>

        <div class="profile-field">
          <span class="profile-field__label">Role</span>
          <Tag
            :value="ROLE_LABEL[user.role] ?? user.role"
            :severity="ROLE_SEVERITY[user.role] ?? 'secondary'"
          />
        </div>

        <div class="profile-field">
          <span class="profile-field__label">Worldbuilder</span>

          <!-- Already a worldbuilder -->
          <div v-if="user.isWorldbuilder" class="profile-wb profile-wb--active">
            <i class="pi pi-check-circle" />
            <span>Worldbuilder access granted — you can create and edit Codex entries.</span>
          </div>

          <!-- Request pending -->
          <div v-else-if="user.worldbuilderRequestPending" class="profile-wb profile-wb--pending">
            <i class="pi pi-clock" />
            <span>Request pending — a DM or Admin will review it soon.</span>
          </div>

          <!-- DM/Admin bypass notice -->
          <div v-else-if="user.role === 'DM' || user.role === 'ADMIN'" class="profile-wb profile-wb--active">
            <i class="pi pi-check-circle" />
            <span>Full Codex access as {{ ROLE_LABEL[user.role] }}.</span>
          </div>

          <!-- Can request -->
          <div v-else class="profile-wb profile-wb--none">
            <span>Players can request Worldbuilder access to create and edit Codex entries.</span>
            <Button
              label="Request access"
              size="small"
              outlined
              :loading="wbRequesting"
              @click="requestWorldbuilder"
            />
            <p v-if="wbError" class="profile-field__error">{{ wbError }}</p>
          </div>
        </div>
      </section>

      <!-- ── DnD Beyond ── -->
      <section class="profile-card">
        <h2 class="profile-card__heading">DnD Beyond Character</h2>

        <div v-if="!user.dndbeyondCharacterId" class="profile-ddb-none">
          <i class="pi pi-info-circle" />
          No character linked. Ask an admin to add your DnD Beyond character ID.
        </div>

        <template v-else>
          <div class="profile-ddb-id">
            <span class="profile-field__label">Character ID</span>
            <span class="profile-field__value">{{ user.dndbeyondCharacterId }}</span>
          </div>

          <div v-if="ddbLoading" class="profile-ddb-loading">
            <i class="pi pi-spin pi-spinner" /> Loading character data…
          </div>

          <div v-else-if="ddbCharacter" class="profile-ddb-character">
            <img
              v-if="ddbCharacter.avatarUrl"
              :src="ddbCharacter.avatarUrl"
              :alt="ddbCharacter.name"
              class="profile-ddb-avatar"
            />
            <div class="profile-ddb-info">
              <span class="profile-ddb-name">{{ ddbCharacter.name }}</span>
              <span class="profile-ddb-class">
                {{ ddbCharacter.classes.map(c => `${c.name} ${c.level}`).join(' / ') }}
                · Level {{ ddbCharacter.totalLevel }}
              </span>
            </div>
            <Button
              icon="pi pi-refresh"
              text
              rounded
              size="small"
              :loading="ddbLoading"
              title="Sync from DnD Beyond"
              @click="syncDdb"
            />
          </div>

          <div v-else class="profile-ddb-none">
            Character data not yet loaded.
            <Button label="Sync now" size="small" outlined @click="syncDdb" />
          </div>

          <p v-if="ddbError" class="profile-field__error">{{ ddbError }}</p>
        </template>
      </section>

      <!-- ── Notifications ── -->
      <section class="profile-card profile-card--link">
        <div class="profile-notif-link">
          <div>
            <h2 class="profile-card__heading profile-card__heading--inline">Notifications</h2>
            <p class="profile-card__sub">Manage which events send you a notification.</p>
          </div>
          <RouterLink to="/notifications" class="profile-link-btn">
            Notification settings <i class="pi pi-arrow-right" />
          </RouterLink>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.profile-view {
  max-width: 640px;
}

.profile-view__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0 0 1.5rem;
}

.profile-sections {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Card */
.profile-card {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius-lg, 10px);
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.profile-card__heading {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ss-text-muted);
  margin: 0 0 0.25rem;
}

.profile-card__heading--inline { margin: 0; }

.profile-card__sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

/* Identity row */
.profile-identity {
  display: flex;
  gap: 1.25rem;
  align-items: flex-start;
}

.profile-identity__avatar { flex-shrink: 0; }

.profile-identity__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

/* Fields */
.profile-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.profile-field__label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ss-text-muted);
}

.profile-field__value-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.profile-field__value {
  font-size: 0.9rem;
  color: var(--ss-text);
  font-weight: 500;
}

.profile-field__value--muted {
  color: var(--ss-text-muted);
  font-weight: 400;
}

.profile-field__edit-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.profile-name-input { width: 220px; }

.profile-field__hint {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: var(--ss-text-muted);
  line-height: 1.5;
}

.profile-field__error {
  margin: 0.2rem 0 0;
  font-size: 0.75rem;
  color: var(--ss-danger, #ef4444);
}

.profile-inline-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.75rem;
  color: var(--ss-primary);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0;
}
.profile-inline-btn:hover { opacity: 0.8; }
.profile-inline-btn .pi { font-size: 0.65rem; }

/* Worldbuilder status */
.profile-wb {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.profile-wb--active {
  color: var(--ss-success, #22c55e);
}
.profile-wb--active .pi { font-size: 1rem; margin-top: 1px; flex-shrink: 0; }

.profile-wb--pending {
  color: var(--ss-text-muted);
}
.profile-wb--pending .pi { font-size: 1rem; margin-top: 1px; flex-shrink: 0; }

.profile-wb--none {
  color: var(--ss-text-muted);
  flex-direction: column;
  align-items: flex-start;
}

/* Notification link */
.profile-notif-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.profile-link-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: var(--ss-primary);
  text-decoration: none;
  font-weight: 500;
  flex-shrink: 0;
}
.profile-link-btn:hover { opacity: 0.8; }
.profile-link-btn .pi { font-size: 0.7rem; }

/* DnD Beyond */
.profile-ddb-none {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
  flex-wrap: wrap;
}

.profile-ddb-id {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.profile-ddb-loading {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.profile-ddb-character {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: var(--ss-parchment-dark);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  padding: 0.6rem 0.75rem;
}

.profile-ddb-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--ss-border);
  flex-shrink: 0;
}

.profile-ddb-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.profile-ddb-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ss-text);
}

.profile-ddb-class {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 767px) {
  .profile-view { max-width: 100%; }
  .profile-identity { flex-direction: column; }
  .profile-name-input { width: 100%; }
}
</style>
