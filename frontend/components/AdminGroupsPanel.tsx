'use client'

import { useEffect, useState } from 'react'
import {
  addGroupMember,
  createGroup,
  deleteGroup,
  fetchGroupMembers,
  fetchGroups,
  fetchUsers,
  removeGroupMember,
  updateGroupPolicy,
} from '@/lib/api'
import { EgressRule, Group, GroupMember, NetworkPolicy, UserRecord } from '@/types'

interface Props {
  onClose: () => void
}

export default function AdminGroupsPanel({ onClose }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<GroupMember[]>([])
  const [allUsers, setAllUsers] = useState<UserRecord[]>([])
  const [activeTab, setActiveTab] = useState<'members' | 'whitelist'>('members')
  const [newGroupName, setNewGroupName] = useState('')
  const [showNewGroupForm, setShowNewGroupForm] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function loadGroups() {
    try {
      const data = await fetchGroups()
      setGroups(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups')
    }
  }

  async function loadMembers(groupId: string) {
    try {
      const [m, u] = await Promise.all([fetchGroupMembers(groupId), fetchUsers()])
      setMembers(m)
      setAllUsers(u)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members')
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  async function selectGroup(g: Group) {
    setSelectedGroup(g)
    setActiveTab('members')
    setError(null)
    await loadMembers(g.id)
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return
    setSaving(true)
    try {
      await createGroup(newGroupName.trim(), '', { defaultAction: 'deny', egress: [] })
      setNewGroupName('')
      setShowNewGroupForm(false)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create group')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteGroup(g: Group) {
    if (!confirm(`Delete group "${g.name}"?`)) return
    try {
      await deleteGroup(g.id)
      if (selectedGroup?.id === g.id) setSelectedGroup(null)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete group')
    }
  }

  async function handleAddMember() {
    if (!selectedGroup || !addMemberUserId) return
    setSaving(true)
    try {
      await addGroupMember(selectedGroup.id, addMemberUserId)
      setAddMemberUserId('')
      await loadMembers(selectedGroup.id)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add member')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!selectedGroup) return
    try {
      await removeGroupMember(selectedGroup.id, userId)
      await loadMembers(selectedGroup.id)
      await loadGroups()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove member')
    }
  }

  async function handleAddDomain() {
    if (!selectedGroup || !newDomain.trim()) return
    const policy = selectedGroup.network_policy
    const updated: NetworkPolicy = {
      defaultAction: policy.defaultAction,
      egress: [...policy.egress, { action: 'allow', target: newDomain.trim() }],
    }
    setSaving(true)
    try {
      await updateGroupPolicy(selectedGroup.id, updated)
      setNewDomain('')
      const refreshed = await fetchGroups()
      setGroups(refreshed)
      const g = refreshed.find(x => x.id === selectedGroup.id)
      if (g) setSelectedGroup(g)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update policy')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveDomain(rule: EgressRule) {
    if (!selectedGroup) return
    const policy = selectedGroup.network_policy
    const updated: NetworkPolicy = {
      defaultAction: policy.defaultAction,
      egress: policy.egress.filter(r => r.target !== rule.target),
    }
    try {
      await updateGroupPolicy(selectedGroup.id, updated)
      const refreshed = await fetchGroups()
      setGroups(refreshed)
      const g = refreshed.find(x => x.id === selectedGroup.id)
      if (g) setSelectedGroup(g)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update policy')
    }
  }

  const nonMembers = allUsers.filter(u => !members.find(m => m.id === u.id))

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="w-[700px] bg-surface border-l border-line flex flex-col shadow-2xl animate-rise">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <h2 className="text-base font-semibold font-display text-fg">Groups</h2>
          <button onClick={onClose} aria-label="Close" className="text-fg-subtle hover:text-fg text-lg cursor-pointer">✕</button>
        </div>

        {error && (
          <div className="mx-5 mt-3 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Groups list */}
          <div className="w-48 border-r border-line flex flex-col flex-shrink-0">
            <div className="flex-1 overflow-y-auto py-2">
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => selectGroup(g)}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-raised/60 group transition-colors ${selectedGroup?.id === g.id ? 'bg-accent/10 border-r-2 border-accent' : ''}`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedGroup?.id === g.id ? 'text-accent' : 'text-fg-muted'}`}>
                      {g.name}
                    </p>
                    <p className="text-xs text-fg-subtle">{g.member_count ?? 0} users</p>
                  </div>
                  {g.name !== 'default' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g) }}
                      aria-label={`Delete group ${g.name}`}
                      className="opacity-0 group-hover:opacity-100 text-fg-subtle/60 hover:text-danger text-xs ml-1 transition-opacity cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-line p-3">
              {showNewGroupForm ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full px-2 py-1.5 text-xs bg-app border border-line rounded-lg text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup() }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleCreateGroup}
                      disabled={saving}
                      className="flex-1 text-xs py-1 bg-accent text-accent-fg font-medium rounded-md hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowNewGroupForm(false); setNewGroupName('') }}
                      className="flex-1 text-xs py-1 border border-line text-fg-muted rounded-md hover:bg-raised transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewGroupForm(true)}
                  className="w-full text-xs text-accent hover:text-accent-hover font-medium transition-colors cursor-pointer"
                >
                  + New group
                </button>
              )}
            </div>
          </div>

          {/* Group detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedGroup ? (
              <div className="flex-1 flex items-center justify-center text-sm text-fg-subtle">
                Select a group
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-line px-5 flex-shrink-0">
                  {(['members', 'whitelist'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${activeTab === tab ? 'border-accent text-accent' : 'border-transparent text-fg-subtle hover:text-fg-muted'}`}
                    >
                      {tab === 'members' ? 'Members' : 'Whitelist'}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {activeTab === 'members' && (
                    <div className="flex flex-col gap-4">
                      {/* Add member */}
                      <div className="flex gap-2">
                        <select
                          value={addMemberUserId}
                          onChange={e => setAddMemberUserId(e.target.value)}
                          className="flex-1 text-sm bg-app border border-line rounded-lg px-2 py-1.5 text-fg focus:outline-none focus:border-accent transition-colors"
                        >
                          <option value="">Add user to group...</option>
                          {nonMembers.map(u => (
                            <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddMember}
                          disabled={!addMemberUserId || saving}
                          className="px-3 py-1.5 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {/* Member list */}
                      {members.length === 0 ? (
                        <p className="text-sm text-fg-subtle">No members yet</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {members.map(m => (
                            <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-raised/60 hover:bg-raised transition-colors">
                              <div>
                                <p className="text-sm text-fg">{m.email}</p>
                                <p className="text-xs text-fg-subtle">{m.role}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                aria-label={`Remove ${m.email}`}
                                className="text-fg-subtle/60 hover:text-danger text-sm transition-colors cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'whitelist' && (
                    <div className="flex flex-col gap-4">
                      <p className="text-xs text-fg-subtle">
                        Allowed domains for sandbox egress. Supports wildcards like <code className="bg-raised px-1 rounded font-mono">*.example.com</code>.
                        Requires egress enabled on OpenSandbox.
                      </p>

                      {/* Add domain */}
                      <div className="flex gap-2">
                        <input
                          value={newDomain}
                          onChange={e => setNewDomain(e.target.value)}
                          placeholder="e.g. marketplace.visualstudio.com"
                          className="flex-1 text-sm bg-app border border-line rounded-lg px-3 py-1.5 text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-colors"
                          onKeyDown={e => { if (e.key === 'Enter') handleAddDomain() }}
                        />
                        <button
                          onClick={handleAddDomain}
                          disabled={!newDomain.trim() || saving}
                          className="px-3 py-1.5 text-sm font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors cursor-pointer"
                        >
                          Add
                        </button>
                      </div>

                      {/* Rules list */}
                      {selectedGroup.network_policy.egress.length === 0 ? (
                        <p className="text-sm text-fg-subtle">No allowed domains. All outbound traffic is blocked.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {selectedGroup.network_policy.egress.map((rule, i) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-raised/60 hover:bg-raised transition-colors">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-ok font-medium">allow</span>
                                <code className="text-sm text-fg font-mono">{rule.target}</code>
                              </div>
                              <button
                                onClick={() => handleRemoveDomain(rule)}
                                aria-label={`Remove ${rule.target}`}
                                className="text-fg-subtle/60 hover:text-danger text-sm transition-colors cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
