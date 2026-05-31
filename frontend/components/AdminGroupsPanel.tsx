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
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="w-[700px] bg-white border-l border-gray-200 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Groups</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>

        {error && (
          <div className="mx-5 mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* Groups list */}
          <div className="w-48 border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="flex-1 overflow-y-auto py-2">
              {groups.map(g => (
                <div
                  key={g.id}
                  onClick={() => selectGroup(g)}
                  className={`flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-50 group ${selectedGroup?.id === g.id ? 'bg-violet-50 border-r-2 border-violet-500' : ''}`}
                >
                  <div className="min-w-0">
                    <p className={`text-sm font-medium truncate ${selectedGroup?.id === g.id ? 'text-violet-700' : 'text-gray-700'}`}>
                      {g.name}
                    </p>
                    <p className="text-xs text-gray-400">{g.member_count ?? 0} users</p>
                  </div>
                  {g.name !== 'default' && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteGroup(g) }}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 text-xs ml-1 transition-opacity"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 p-3">
              {showNewGroupForm ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={newGroupName}
                    onChange={e => setNewGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-violet-500"
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateGroup() }}
                    autoFocus
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleCreateGroup}
                      disabled={saving}
                      className="flex-1 text-xs py-1 bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => { setShowNewGroupForm(false); setNewGroupName('') }}
                      className="flex-1 text-xs py-1 border border-gray-200 text-gray-600 rounded hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewGroupForm(true)}
                  className="w-full text-xs text-violet-600 hover:text-violet-700 font-medium"
                >
                  + New group
                </button>
              )}
            </div>
          </div>

          {/* Group detail */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedGroup ? (
              <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
                Select a group
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-5 flex-shrink-0">
                  {(['members', 'whitelist'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-violet-500 text-violet-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
                          className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                        >
                          <option value="">Add user to group…</option>
                          {nonMembers.map(u => (
                            <option key={u.id} value={u.id}>{u.email} ({u.role})</option>
                          ))}
                        </select>
                        <button
                          onClick={handleAddMember}
                          disabled={!addMemberUserId || saving}
                          className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>

                      {/* Member list */}
                      {members.length === 0 ? (
                        <p className="text-sm text-gray-400">No members yet</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {members.map(m => (
                            <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 hover:bg-gray-100">
                              <div>
                                <p className="text-sm text-gray-800">{m.email}</p>
                                <p className="text-xs text-gray-400">{m.role}</p>
                              </div>
                              <button
                                onClick={() => handleRemoveMember(m.id)}
                                className="text-gray-300 hover:text-red-500 text-sm transition-colors"
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
                      <p className="text-xs text-gray-500">
                        Allowed domains for sandbox egress. Supports wildcards like <code className="bg-gray-100 px-1 rounded">*.example.com</code>.
                        Requires egress enabled on OpenSandbox.
                      </p>

                      {/* Add domain */}
                      <div className="flex gap-2">
                        <input
                          value={newDomain}
                          onChange={e => setNewDomain(e.target.value)}
                          placeholder="e.g. marketplace.visualstudio.com"
                          className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500"
                          onKeyDown={e => { if (e.key === 'Enter') handleAddDomain() }}
                        />
                        <button
                          onClick={handleAddDomain}
                          disabled={!newDomain.trim() || saving}
                          className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>

                      {/* Rules list */}
                      {selectedGroup.network_policy.egress.length === 0 ? (
                        <p className="text-sm text-gray-400">No allowed domains — all outbound traffic is blocked.</p>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {selectedGroup.network_policy.egress.map((rule, i) => (
                            <div key={i} className="flex items-center justify-between py-2 px-3 rounded bg-gray-50 hover:bg-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-emerald-600 font-medium">✓ allow</span>
                                <code className="text-sm text-gray-800">{rule.target}</code>
                              </div>
                              <button
                                onClick={() => handleRemoveDomain(rule)}
                                className="text-gray-300 hover:text-red-500 text-sm transition-colors"
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
