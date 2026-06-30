<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import Avatar from 'primevue/avatar'
import { adminService, type AdminUser } from '@/services/adminService'
import { roomService, type Room } from '@/services/roomService'

const users = ref<AdminUser[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const rooms = ref<Room[]>([])

const editTarget = ref<AdminUser | null>(null)
const editRole = ref<'PLAYER' | 'ADMIN'>('PLAYER')
const editStoryDm = ref(false)
const editWorldbuilder = ref(false)
const editDndId = ref('')
const editDefaultRoom = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

const { t } = useI18n()

const ROLE_OPTIONS = computed(() => [
  { label: t('admin.roles.player'), value: 'PLAYER' },
  { label: t('admin.roles.admin'), value: 'ADMIN' },
])

onMounted(async () => {
  loading.value = true
  const [usersResult, roomsResult] = await Promise.all([adminService.listUsers(), roomService.list()])
  loading.value = false
  if (usersResult.type === 'ok') users.value = usersResult.data
  else error.value = usersResult.message
  if (roomsResult.type === 'ok') rooms.value = roomsResult.data
})

const defaultRoomOptions = computed(() => [
  { label: '— Geen standaard ruimte —', value: null },
  ...rooms.value.filter(r => r.isActive).map(r => ({ label: r.name, value: r.name })),
])

function openEdit(user: AdminUser) {
  editTarget.value = { ...user }
  editRole.value = user.role
  editStoryDm.value = user.isStoryDm
  editWorldbuilder.value = user.isWorldbuilder
  editDndId.value = user.dndbeyondCharacterId ?? ''
  editDefaultRoom.value = user.defaultRoom ?? null
  saveError.value = null
}

function closeEdit() {
  editTarget.value = null
}

async function saveEdit() {
  if (!editTarget.value) return
  saving.value = true
  saveError.value = null
  // Accept full DnD Beyond URL or plain numeric ID
  const rawDndId = editDndId.value.trim()
  const urlMatch = rawDndId.match(/^https?:\/\/(www\.)?dndbeyond\.com\/characters\/(\d+)/i)
  const normalizedDndId = urlMatch ? urlMatch[2] : /^\d+$/.test(rawDndId) ? rawDndId : null

  const result = await adminService.updateUser(editTarget.value.id, {
    role: editRole.value,
    isStoryDm: editStoryDm.value,
    isWorldbuilder: editWorldbuilder.value,
    dndbeyondCharacterId: normalizedDndId,
    defaultRoom: editDefaultRoom.value || null,
  })
  saving.value = false
  if (result.type === 'error') {
    saveError.value = result.message
    return
  }
  // Patch local list
  const idx = users.value.findIndex((u) => u.id === result.data.id)
  if (idx !== -1) users.value[idx] = result.data
  closeEdit()
}

async function approveWorldbuilder(user: AdminUser) {
  const result = await adminService.updateUser(user.id, {
    isWorldbuilder: true,
    worldbuilderRequestPending: false,
  })
  if (result.type === 'ok') {
    const idx = users.value.findIndex((u) => u.id === result.data.id)
    if (idx !== -1) users.value[idx] = result.data
    if (editTarget.value?.id === user.id) {
      editTarget.value = result.data
      editWorldbuilder.value = true
    }
  }
}

async function rejectWorldbuilder(user: AdminUser) {
  const result = await adminService.updateUser(user.id, {
    worldbuilderRequestPending: false,
  })
  if (result.type === 'ok') {
    const idx = users.value.findIndex((u) => u.id === result.data.id)
    if (idx !== -1) users.value[idx] = result.data
    if (editTarget.value?.id === user.id) {
      editTarget.value = result.data
    }
  }
}

function roleSeverity(role: string): 'danger' | 'secondary' {
  if (role === 'ADMIN') return 'danger'
  return 'secondary'
}

function roleLabel(role: string) {
  if (role === 'ADMIN') return t('admin.roles.admin')
  return t('admin.roles.player')
}

function initials(user: AdminUser) {
  return (user.displayName || user.name).charAt(0).toUpperCase() || '?'
}

const pendingRequests = computed(() => users.value.filter((u) => u.worldbuilderRequestPending))
</script>

<template>
  <div class="admin-view">
    <div class="admin-view__header">
      <h1 class="admin-view__title">{{ $t('admin.title') }}</h1>
      <div class="admin-header-links">
        <router-link to="/admin/signups" class="admin-rooms-link">
          <i class="pi pi-list" /> Aanmeldingen
        </router-link>
        <router-link to="/admin/rooms" class="admin-rooms-link">
          <i class="pi pi-map-marker" /> Ruimteplanning
        </router-link>
        <router-link to="/admin/instant-mode" class="admin-rooms-link">
          <i class="pi pi-bolt" /> Instant mode
        </router-link>
        <router-link to="/admin/archive" class="admin-rooms-link">
          <i class="pi pi-inbox" /> Archief
        </router-link>
      </div>
    </div>

    <!-- Worldbuilder pending requests -->
    <section v-if="pendingRequests.length" class="admin-requests">
      <h2 class="admin-requests__heading">
        <i class="pi pi-bell admin-requests__icon" />
        {{ $t('admin.worldbuilderRequests.heading') }}
        <span class="admin-requests__count">{{ pendingRequests.length }}</span>
      </h2>
      <ul class="admin-requests__list">
        <li v-for="user in pendingRequests" :key="user.id" class="admin-requests__item">
          <Avatar
            :image="user.avatarUrl ?? undefined"
            :label="user.avatarUrl ? undefined : initials(user)"
            shape="circle"
            class="admin-requests__avatar"
          />
          <div class="admin-requests__info">
            <span class="admin-requests__name">{{ user.displayName || user.name }}</span>
            <span class="admin-requests__email">{{ user.email }}</span>
          </div>
          <div class="admin-requests__actions">
            <Button
              :label="$t('common.approve')"
              icon="pi pi-check"
              size="small"
              severity="success"
              @click="approveWorldbuilder(user)"
            />
            <Button
              :label="$t('common.reject')"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              text
              @click="rejectWorldbuilder(user)"
            />
          </div>
        </li>
      </ul>
    </section>

    <section class="admin-section">
      <h2 class="admin-section__heading">
        <i class="pi pi-users admin-section__icon" />
        {{ $t('admin.users.sectionHeading') }}
      </h2>

      <div v-if="loading" class="admin-loading">
        <i class="pi pi-spin pi-spinner" /> {{ $t('common.loading') }}
      </div>
      <div v-else-if="error" class="admin-error">{{ error }}</div>

      <DataTable
        v-else
        :value="users"
        class="admin-table"
        size="small"
        striped-rows
        :global-filter-fields="['displayName', 'email', 'role']"
      >
        <Column :header="$t('admin.users.columns.user')" :sortable="false" style="min-width: 200px">
          <template #body="{ data }">
            <div class="admin-table__user">
              <Avatar
                :image="data.avatarUrl ?? undefined"
                :label="data.avatarUrl ? undefined : initials(data)"
                shape="circle"
                class="admin-table__avatar"
              />
              <div class="admin-table__user-info">
                <span class="admin-table__name">{{ data.displayName || data.name }}</span>
                <span class="admin-table__email">{{ data.email }}</span>
              </div>
            </div>
          </template>
        </Column>

        <Column :header="$t('admin.users.columns.role')" style="width: 100px">
          <template #body="{ data }">
            <Tag :value="roleLabel(data.role)" :severity="roleSeverity(data.role)" />
          </template>
        </Column>

        <Column :header="$t('admin.users.columns.worldbuilder')" style="width: 120px">
          <template #body="{ data }">
            <div class="admin-table__wb">
              <Tag
                v-if="data.isWorldbuilder"
                :value="$t('admin.users.worldbuilderYes')"
                severity="success"
              />
              <Tag v-else :value="$t('admin.users.worldbuilderNo')" severity="secondary" />
              <Tag
                v-if="data.worldbuilderRequestPending"
                :value="$t('admin.users.worldbuilderRequested')"
                severity="warn"
                class="admin-table__pending-tag"
              />
            </div>
          </template>
        </Column>

        <Column header="Story DM" style="width: 120px">
          <template #body="{ data }">
            <Tag
              v-if="data.isStoryDm"
              value="Ja"
              severity="success"
            />
            <Tag v-else value="Nee" severity="secondary" />
          </template>
        </Column>

        <Column :header="$t('admin.users.columns.dndBeyond')" style="width: 130px">
          <template #body="{ data }">
            <span v-if="data.dndbeyondCharacterId" class="admin-table__dndbeyond">
              <i class="pi pi-link" />
              {{ data.dndbeyondCharacterId }}
            </span>
            <span v-else class="admin-table__empty">—</span>
          </template>
        </Column>

        <Column style="width: 80px; text-align: right">
          <template #body="{ data }">
            <Button
              icon="pi pi-pencil"
              text
              rounded
              size="small"
              :aria-label="$t('common.edit')"
              @click="openEdit(data)"
            />
          </template>
        </Column>
      </DataTable>
    </section>

    <!-- Edit dialog -->
    <Dialog
      :visible="!!editTarget"
      :header="editTarget ? editTarget.displayName || editTarget.name : ''"
      modal
      :draggable="false"
      class="admin-edit-dialog"
      @update:visible="closeEdit"
    >
      <template v-if="editTarget">
        <div class="admin-edit__fields">
          <!-- Role -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">{{ $t('admin.edit.roleLabel') }}</label>
            <Select
              v-model="editRole"
              :options="ROLE_OPTIONS"
              option-label="label"
              option-value="value"
              class="admin-edit__select"
            />
          </div>

          <!-- Worldbuilder toggle -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">{{ $t('admin.edit.worldbuilderLabel') }}</label>
            <div class="admin-edit__toggle-row">
              <ToggleSwitch v-model="editWorldbuilder" />
              <span class="admin-edit__toggle-hint">
                {{
                  editWorldbuilder
                    ? $t('admin.edit.worldbuilderEnabled')
                    : $t('admin.edit.worldbuilderDisabled')
                }}
              </span>
            </div>
          </div>

          <!-- Worldbuilder request pending -->
          <div
            v-if="editTarget.worldbuilderRequestPending"
            class="admin-edit__field admin-edit__wb-request"
          >
            <div class="admin-edit__wb-request-row">
              <Tag :value="$t('admin.edit.worldbuilderRequestedTag')" severity="warn" />
              <span class="admin-edit__wb-request-hint">{{
                $t('admin.edit.worldbuilderRequestHint')
              }}</span>
            </div>
            <div class="admin-edit__wb-actions">
              <Button
                :label="$t('common.approve')"
                icon="pi pi-check"
                size="small"
                severity="success"
                @click="approveWorldbuilder(editTarget)"
              />
              <Button
                :label="$t('common.reject')"
                icon="pi pi-times"
                size="small"
                severity="secondary"
                text
                @click="rejectWorldbuilder(editTarget)"
              />
            </div>
          </div>

          <!-- Story DM toggle -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">{{ $t('admin.edit.storyDmLabel') }}</label>
            <div class="admin-edit__toggle-row">
              <ToggleSwitch v-model="editStoryDm" />
              <span class="admin-edit__toggle-hint">
                {{ editStoryDm ? $t('admin.edit.storyDmEnabled') : $t('admin.edit.storyDmDisabled') }}
              </span>
            </div>
          </div>

          <!-- Default room -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">Standaard ruimte</label>
            <Select
              v-model="editDefaultRoom"
              :options="defaultRoomOptions"
              option-label="label"
              option-value="value"
              class="admin-edit__select"
              placeholder="Geen standaard ruimte"
            />
            <span class="admin-edit__hint">Wordt automatisch aan sessies van deze DM toegewezen.</span>
          </div>

          <!-- DnD Beyond character ID -->
          <div class="admin-edit__field">
            <label class="admin-edit__label">{{ $t('admin.edit.dndBeyondLabel') }}</label>
            <InputText
              v-model="editDndId"
              :placeholder="$t('admin.edit.dndBeyondPlaceholder')"
              class="admin-edit__input"
            />
            <span class="admin-edit__hint">{{ $t('admin.edit.dndBeyondHint') }}</span>
          </div>

          <p v-if="saveError" class="admin-edit__error">{{ saveError }}</p>
        </div>
      </template>

      <template #footer>
        <Button :label="$t('common.cancel')" text @click="closeEdit" />
        <Button :label="$t('common.save')" icon="pi pi-check" :loading="saving" @click="saveEdit" />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.admin-view {
  max-width: 960px;
  padding: 1.5rem;
}

.admin-view__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.admin-view__title {
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--ss-text);
  margin: 0;
}

.admin-header-links {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.admin-rooms-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ss-primary);
  text-decoration: none;
  padding: 0.4rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--ss-primary) 30%, transparent);
  border-radius: var(--ss-radius-sm);
  transition: background 0.15s;
}

.admin-rooms-link:hover {
  background: color-mix(in srgb, var(--ss-primary) 8%, transparent);
}

/* ── Pending requests banner ── */
.admin-requests {
  background: color-mix(in srgb, var(--ss-warning, #f59e0b) 8%, var(--ss-surface));
  border: 1px solid color-mix(in srgb, var(--ss-warning, #f59e0b) 35%, transparent);
  border-radius: var(--ss-radius);
  margin-bottom: 1.25rem;
  overflow: hidden;
}

.admin-requests__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ss-text);
  padding: 0.75rem 1.25rem;
  margin: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ss-warning, #f59e0b) 25%, transparent);
}

.admin-requests__icon {
  color: var(--ss-warning, #f59e0b);
}

.admin-requests__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2em;
  height: 1.2em;
  padding: 0 0.3em;
  border-radius: 99px;
  background: var(--ss-warning, #f59e0b);
  color: #000;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 0.2rem;
}

.admin-requests__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.admin-requests__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1.25rem;
  border-bottom: 1px solid color-mix(in srgb, var(--ss-warning, #f59e0b) 15%, transparent);
}

.admin-requests__item:last-child {
  border-bottom: none;
}

.admin-requests__avatar {
  width: 30px;
  height: 30px;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.admin-requests__info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  flex: 1;
  min-width: 0;
}

.admin-requests__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ss-text);
}

.admin-requests__email {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
}

.admin-requests__actions {
  display: flex;
  gap: 0.4rem;
  flex-shrink: 0;
}

/* ── Section ── */
.admin-section {
  background: var(--ss-surface);
  border: 1px solid var(--ss-border);
  border-radius: var(--ss-radius);
  overflow: hidden;
}

.admin-section__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ss-text);
  padding: 1rem 1.25rem;
  margin: 0;
  border-bottom: 1px solid var(--ss-border);
}

.admin-section__icon {
  color: var(--ss-primary);
}

/* ── States ── */
.admin-loading,
.admin-error {
  padding: 2rem;
  text-align: center;
  color: var(--ss-text-muted);
  font-size: 0.9rem;
}

.admin-error {
  color: var(--ss-danger);
}

/* ── Table cells ── */
.admin-table__user {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.admin-table__avatar {
  width: 28px;
  height: 28px;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.admin-table__user-info {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.admin-table__name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ss-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-table__email {
  font-size: 0.72rem;
  color: var(--ss-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.admin-table__wb {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
}

.admin-table__pending-tag {
  font-size: 0.62rem !important;
}

.admin-table__dndbeyond {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.admin-table__empty {
  color: var(--ss-text-subtle, #aaa);
}

/* ── Edit dialog ── */
.admin-edit__fields {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 320px;
  padding: 0.25rem 0;
}

.admin-edit__field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.admin-edit__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ss-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.admin-edit__select,
.admin-edit__input {
  width: 100%;
}

.admin-edit__hint {
  font-size: 0.7rem;
  color: var(--ss-text-muted);
  opacity: 0.75;
}

.admin-edit__toggle-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-edit__toggle-hint {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.admin-edit__wb-request {
  background: color-mix(in srgb, var(--ss-warning, #f59e0b) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--ss-warning, #f59e0b) 30%, transparent);
  border-radius: var(--ss-radius-sm, 6px);
  padding: 0.75rem;
  gap: 0.6rem;
}

.admin-edit__wb-request-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.admin-edit__wb-request-hint {
  font-size: 0.8rem;
  color: var(--ss-text-muted);
}

.admin-edit__wb-actions {
  display: flex;
  gap: 0.5rem;
}

.admin-edit__error {
  font-size: 0.85rem;
  color: var(--ss-danger);
  margin: 0;
}
</style>
